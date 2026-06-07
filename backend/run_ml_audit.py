import os
import sys
import json
import numpy as np
import pandas as pd
import joblib
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
sys.path.append(str(backend_dir))

from app.database import SessionLocal
from app.models.ae_models import AEFlightDataset
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.dummy import DummyRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
from sklearn.model_selection import TimeSeriesSplit, learning_curve as sklearn_learning_curve
import xgboost as xgb
import shap

# Constants matching train_v2.py
BASE_FEATURES = [
    "dep_hour", "is_weekend", "is_peak_hour",
    "distance_km", "duration_min",
    "airline_enc", "dep_airport_enc", "arr_airport_enc",
]
ROLLING_FEATURES = [
    "route_avg_delay_hist", "airline_avg_delay_hist", "hour_avg_delay_hist",
    "route_flight_count", "airline_flight_count", "airport_departure_count",
    "dep_month", "dep_day_of_week",
]
ALL_FEATURES = BASE_FEATURES + ROLLING_FEATURES
TARGET = "delay_minutes"
TARGET_CLASS = "is_delayed"

def main():
    print("=" * 60)
    print("           SMART AIRPORT ML AUDIT SCRIPT")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        # ----------------------------------------------------
        # TASK 1: DATASET DESCRIPTION
        # ----------------------------------------------------
        print("\n--- TASK 1: DATASET DESCRIPTION ---")
        
        # 1. Total records
        total_records_db = db.query(AEFlightDataset).count()
        print(f"Total number of records in table 'ae_flight_dataset': {total_records_db}")
        
        # Load all records into DataFrame to analyze
        query = db.query(AEFlightDataset)
        df_all = pd.read_sql(query.statement, db.bind)
        
        print(f"Total records loaded in DataFrame: {len(df_all)}")
        
        # 2. All column names
        print("\nAll columns in database table:")
        print(list(df_all.columns))
        
        # 3. Target variable name and type
        print(f"\nTarget Variable Name (Regression): {TARGET} (Type: regression)")
        print(f"Target Variable Name (Classification): {TARGET_CLASS} (Type: binary classification)")
        
        # 4. Time period covered
        min_date = df_all['flight_date'].min()
        max_date = df_all['flight_date'].max()
        print(f"\nTime period covered: Min Date = {min_date}, Max Date = {max_date}")
        
        # 5. Unique airports and airlines
        unique_airports = set(df_all['dep_iata'].dropna().unique()) | set(df_all['arr_iata'].dropna().unique())
        unique_airlines = df_all['airline_iata'].dropna().nunique()
        print(f"Number of unique airports: {len(unique_airports)}")
        print(f"Number of unique airlines: {unique_airlines}")
        
        # 6. Missing values per column
        print("\nMissing values per column:")
        missing_counts = df_all.isnull().sum()
        missing_pct = (df_all.isnull().sum() / len(df_all)) * 100
        missing_df = pd.DataFrame({'Missing Count': missing_counts, 'Percentage (%)': missing_pct})
        print(missing_df.to_string())
        
        # 7. Distribution of target variable
        print("\nDistribution of the target variable 'delay_minutes':")
        delay_stats = df_all[TARGET].describe()
        print(f"  Mean:   {delay_stats['mean']:.4f}")
        print(f"  Median: {df_all[TARGET].median():.4f}")
        print(f"  Std:    {delay_stats['std']:.4f}")
        print(f"  Min:    {delay_stats['min']:.4f}")
        print(f"  Max:    {delay_stats['max']:.4f}")
        
        # 8. Percentage of delayed vs on-time flights (use >15 minutes as threshold)
        delayed_count_15 = (df_all[TARGET] > 15).sum()
        ontime_count_15 = (df_all[TARGET] <= 15).sum()
        total_valid = len(df_all)
        print(f"\nDelay Threshold (>15 minutes):")
        print(f"  Delayed flights: {delayed_count_15} ({delayed_count_15 / total_valid * 100:.2f}%)")
        print(f"  On-time flights: {ontime_count_15} ({ontime_count_15 / total_valid * 100:.2f}%)")
        
        # 9. Train/test split ratio used in train_v2.py
        print("\nTrain/test split method used in train_v2.py:")
        print("  Method: Time-based split (no random shuffle)")
        print("  Split ratio: 80% train, 20% test (VAL_FRACTION = 0.20)")
        
        # ----------------------------------------------------
        # PREPARE DATASET FOR TRAINING AND EVALUATION (Matching train_v2.py)
        # ----------------------------------------------------
        # Load filtered dataset
        df_filtered = df_all[
            (df_all['usable_for_ml'] == True) &
            (df_all['dep_hour'].notnull()) &
            (df_all['distance_km'].notnull()) &
            (df_all['airline_enc'].notnull()) &
            (df_all['final_status'] != 'cancelled') &
            ((df_all['completeness'] >= 0.6) | (df_all['completeness'].isnull()))
        ].copy()
        
        df_filtered = df_filtered.sort_values("flight_date").reset_index(drop=True)
        
        # Map metadata columns with underscore prefix for rolling features
        df_filtered['_dep_iata'] = df_filtered['dep_iata']
        df_filtered['_arr_iata'] = df_filtered['arr_iata']
        df_filtered['_airline_iata'] = df_filtered['airline_iata']
        df_filtered['_flight_date'] = df_filtered['flight_date']
        
        # Coerce and clip target
        df_filtered[TARGET] = pd.to_numeric(df_filtered[TARGET], errors="coerce").fillna(0)
        p99 = float(df_filtered[TARGET].quantile(0.99))
        df_filtered[TARGET] = df_filtered[TARGET].clip(upper=p99)
        
        # Coerce base features
        for col in BASE_FEATURES:
            df_filtered[col] = pd.to_numeric(df_filtered[col], errors="coerce").fillna(0)
            
        print(f"\nFiltered ML-ready dataset size: {len(df_filtered)}")
        
        # Time split
        cutoff_idx = int(len(df_filtered) * 0.8)
        train_df = df_filtered.iloc[:cutoff_idx].copy()
        test_df = df_filtered.iloc[cutoff_idx:].copy()
        
        print(f"Train size: {len(train_df)} | Test size: {len(test_df)}")
        
        # Rolling features
        from app.ml.rolling_features import enrich_with_rolling_features
        try:
            train_df, test_df = enrich_with_rolling_features(train_df, test_df)
            feature_cols = ALL_FEATURES
            print("Rolling features enrichment: Success")
        except Exception as e:
            print(f"Rolling features enrichment failed: {e}. Falling back to base features.")
            feature_cols = BASE_FEATURES
            
        # Null-fill features
        for col in feature_cols:
            train_df[col] = pd.to_numeric(train_df[col], errors="coerce").fillna(0)
            test_df[col] = pd.to_numeric(test_df[col], errors="coerce").fillna(0)
            
        X_train = train_df[feature_cols].values.astype(np.float32)
        y_train = train_df[TARGET].values.astype(np.float32)
        X_test = test_df[feature_cols].values.astype(np.float32)
        y_test = test_df[TARGET].values.astype(np.float32)
        
        # ----------------------------------------------------
        # TASK 2: MODEL EVALUATION (DEEP)
        # ----------------------------------------------------
        print("\n--- TASK 2: MODEL EVALUATION (DEEP) ---")
        
        # Instantiate and train XGBoost Regressor
        n_samples = len(X_train)
        n_est = min(500, max(100, n_samples // 3))
        depth = 5 if n_samples < 500 else 6
        lr = 0.05 if n_samples < 1000 else 0.03
        mcw = max(3, n_samples // 200)
        
        xgb_reg_params = {
            'n_estimators': n_est,
            'max_depth': depth,
            'learning_rate': lr,
            'subsample': 0.8,
            'colsample_bytree': 0.8,
            'min_child_weight': mcw,
            'gamma': 0.1,
            'reg_alpha': 0.1,
            'reg_lambda': 1.0,
            'random_state': 42,
            'eval_metric': 'mae'
        }
        
        print("XGBoost Regressor Hyperparameters:")
        print(json.dumps(xgb_reg_params, indent=2))
        
        xgb_pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", xgb.XGBRegressor(**xgb_reg_params))
        ])
        
        xgb_pipeline.fit(X_train, y_train)
        y_pred = np.maximum(xgb_pipeline.predict(X_test), 0.0)
        
        # XGBoost metrics
        mae_xgb = mean_absolute_error(y_test, y_pred)
        rmse_xgb = np.sqrt(mean_squared_error(y_test, y_pred))
        r2_xgb = r2_score(y_test, y_pred)
        
        print("\nXGBoost Regressor on Test Set:")
        print(f"  MAE:  {mae_xgb:.4f} minutes")
        print(f"  RMSE: {rmse_xgb:.4f} minutes")
        print(f"  R²:   {r2_xgb:.6f}")
        
        # Dummy Regressor (mean strategy)
        dummy = DummyRegressor(strategy="mean")
        dummy.fit(X_train, y_train)
        y_pred_dummy = dummy.predict(X_test)
        
        mae_dummy = mean_absolute_error(y_test, y_pred_dummy)
        rmse_dummy = np.sqrt(mean_squared_error(y_test, y_pred_dummy))
        r2_dummy = r2_score(y_test, y_pred_dummy)
        
        print("\nDummyRegressor (mean strategy) on Test Set:")
        print(f"  MAE:  {mae_dummy:.4f} minutes")
        print(f"  RMSE: {rmse_dummy:.4f} minutes")
        print(f"  R²:   {r2_dummy:.6f}")
        
        # 5-fold TimeSeries CV
        print("\nRunning 5-fold TimeSeries Cross-Validation...")
        tscv = TimeSeriesSplit(n_splits=5)
        cv_r2_scores = []
        for fold, (tr_idx, te_idx) in enumerate(tscv.split(X_train)):
            X_tr, y_tr = X_train[tr_idx], y_train[tr_idx]
            X_te, y_te = X_train[te_idx], y_train[te_idx]
            
            fold_pipeline = Pipeline([
                ("scaler", StandardScaler()),
                ("regressor", xgb.XGBRegressor(**xgb_reg_params))
            ])
            fold_pipeline.fit(X_tr, y_tr)
            fold_preds = np.maximum(fold_pipeline.predict(X_te), 0.0)
            fold_r2 = r2_score(y_te, fold_preds)
            cv_r2_scores.append(fold_r2)
            print(f"  Fold {fold+1} R²: {fold_r2:.6f}")
            
        mean_cv_r2 = np.mean(cv_r2_scores)
        std_cv_r2 = np.std(cv_r2_scores)
        print(f"5-fold CV R²: {cv_r2_scores}")
        print(f"Mean ± Std CV R²: {mean_cv_r2:.6f} ± {std_cv_r2:.6f}")
        
        print(f"\nExact sizes of splits:")
        print(f"  Training set size: {len(X_train)} records")
        print(f"  Test set size:     {len(X_test)} records")
        
        # Classification counterpart evaluation (since XGBoost Classifier is asked)
        print("\nEvaluating XGBoost Classifier (is_delayed target)...")
        y_class_train = train_df[TARGET_CLASS].values.astype(np.int32)
        y_class_test = test_df[TARGET_CLASS].values.astype(np.int32)
        
        xgb_clf_params = {
            'n_estimators': n_est,
            'max_depth': depth,
            'learning_rate': lr,
            'subsample': 0.8,
            'colsample_bytree': 0.8,
            'random_state': 42,
            'eval_metric': 'logloss'
        }
        
        xgb_clf_pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("classifier", xgb.XGBClassifier(**xgb_clf_params))
        ])
        xgb_clf_pipeline.fit(X_train, y_class_train)
        y_class_pred = xgb_clf_pipeline.predict(X_test)
        
        acc = accuracy_score(y_class_test, y_class_pred)
        prec = precision_score(y_class_test, y_class_pred, zero_division=0)
        rec = recall_score(y_class_test, y_class_pred, zero_division=0)
        f1 = f1_score(y_class_test, y_class_pred, zero_division=0)
        cm = confusion_matrix(y_class_test, y_class_pred)
        
        print("\nXGBoost Classifier on Test Set:")
        print(f"  Accuracy:  {acc:.4f}")
        print(f"  Precision: {prec:.4f}")
        print(f"  Recall:    {rec:.4f}")
        print(f"  F1 Score:  {f1:.4f}")
        print("  Confusion Matrix:")
        print(cm)
        
        # ----------------------------------------------------
        # TASK 3: SHAP ANALYSIS
        # ----------------------------------------------------
        print("\n--- TASK 3: SHAP ANALYSIS ---")
        
        scaler = xgb_pipeline.named_steps["scaler"]
        regressor = xgb_pipeline.named_steps["regressor"]
        X_test_scaled = scaler.transform(X_test)
        
        # Build TreeExplainer
        explainer = shap.TreeExplainer(regressor)
        shap_values = explainer.shap_values(X_test_scaled)
        
        # Print top 10 most important features (mean absolute SHAP)
        mean_abs_shap = np.mean(np.abs(shap_values), axis=0)
        feat_imp_df = pd.DataFrame({
            'Feature': feature_cols,
            'Mean Absolute SHAP': mean_abs_shap
        }).sort_values('Mean Absolute SHAP', ascending=False).reset_index(drop=True)
        
        print("\nTop 10 most important features (Mean Absolute SHAP):")
        print(feat_imp_df.head(10).to_string())
        
        # Generate summary plot (beeswarm)
        print("\nGenerating SHAP Summary Plot (Beeswarm)...")
        plt.figure(figsize=(10, 6))
        shap.summary_plot(shap_values, X_test_scaled, feature_names=feature_cols, show=False)
        plt.tight_layout()
        plt.savefig("shap_summary.png", dpi=150)
        plt.close()
        print("  Saved shap_summary.png")
        
        # Generate bar chart (mean absolute SHAP values)
        print("Generating SHAP Importance Bar Chart...")
        plt.figure(figsize=(10, 6))
        shap.summary_plot(shap_values, X_test_scaled, feature_names=feature_cols, plot_type="bar", show=False)
        plt.tight_layout()
        plt.savefig("shap_importance.png", dpi=150)
        plt.close()
        print("  Saved shap_importance.png")
        
        # Generate waterfall plot for one sample (index 0)
        print("Generating SHAP Waterfall Plot for sample 0...")
        plt.figure(figsize=(10, 6))
        # Construct shap.Explanation object for matplotlib plotting
        exp = shap.Explanation(
            values=shap_values[0],
            base_values=explainer.expected_value,
            data=X_test[0], # raw values
            feature_names=feature_cols
        )
        shap.plots.waterfall(exp, show=False)
        plt.tight_layout()
        plt.savefig("shap_waterfall.png", dpi=150)
        plt.close()
        print("  Saved shap_waterfall.png")
        
        # ----------------------------------------------------
        # TASK 4: LEARNING CURVE
        # ----------------------------------------------------
        print("\n--- TASK 4: LEARNING CURVE ---")
        
        train_sizes = np.linspace(0.1, 1.0, 5)
        # We can write a custom learning curve loop to compute R2 scores at different training sizes
        # using the TimeSeriesSplit cross-validation, or train on subsets of X_train and evaluate on the test set,
        # or use 5-fold cross-validation. Let's do 5-fold TimeSeriesSplit on each size subset of the training set.
        print("Calculating train and validation R² at different training sizes...")
        print(f"{'Train Size':<12} | {'Train R²':<10} | {'Val R² (CV)':<12}")
        print("-" * 40)
        
        # We will use TimeSeriesSplit for CV evaluation at each subset size
        train_sizes_records = []
        train_r2_means = []
        val_r2_means = []
        
        for fraction in [0.1, 0.25, 0.5, 0.75, 1.0]:
            size = int(len(X_train) * fraction)
            train_sizes_records.append(size)
            
            X_subset = X_train[:size]
            y_subset = y_train[:size]
            
            if size < 20: # too small for 5-fold time series split
                continue
                
            # Train score
            model_sub = Pipeline([
                ("scaler", StandardScaler()),
                ("regressor", xgb.XGBRegressor(**xgb_reg_params))
            ])
            model_sub.fit(X_subset, y_subset)
            train_pred = np.maximum(model_sub.predict(X_subset), 0.0)
            train_r2 = r2_score(y_subset, train_pred)
            
            # CV Validation score
            sub_tscv = TimeSeriesSplit(n_splits=5)
            sub_val_r2s = []
            for fold, (tr_idx, te_idx) in enumerate(sub_tscv.split(X_subset)):
                if len(tr_idx) < 10 or len(te_idx) < 2:
                    continue
                X_tr, y_tr = X_subset[tr_idx], y_subset[tr_idx]
                X_te, y_te = X_subset[te_idx], y_subset[te_idx]
                
                fold_model = Pipeline([
                    ("scaler", StandardScaler()),
                    ("regressor", xgb.XGBRegressor(**xgb_reg_params))
                ])
                fold_model.fit(X_tr, y_tr)
                fold_preds = np.maximum(fold_model.predict(X_te), 0.0)
                sub_val_r2s.append(r2_score(y_te, fold_preds))
                
            val_r2_mean = np.mean(sub_val_r2s) if sub_val_r2s else 0.0
            train_r2_means.append(train_r2)
            val_r2_means.append(val_r2_mean)
            print(f"{size:<12} | {train_r2:<10.4f} | {val_r2_mean:<12.4f}")
            
        # Plot learning curve
        plt.figure(figsize=(10, 6))
        plt.plot(train_sizes_records, train_r2_means, 'o-', color="r", label="Training score R²")
        plt.plot(train_sizes_records, val_r2_means, 'o-', color="g", label="Cross-validation score R²")
        plt.title("XGBoost Learning Curve (TimeSeriesSplit 5-fold CV)")
        plt.xlabel("Training Set Size (records)")
        plt.ylabel("R² Score")
        plt.grid(True)
        plt.legend(loc="best")
        plt.tight_layout()
        plt.savefig("learning_curve.png", dpi=150)
        plt.close()
        print("\n  Saved learning_curve.png")
        
        # Copy generated files to artifact directory if it exists
        artifact_path = Path("C:/Users/gzhan/.gemini/antigravity/brain/3563f577-a3b5-489c-9025-a5a16ea4684e")
        if artifact_path.exists():
            import shutil
            for f in ["shap_summary.png", "shap_importance.png", "shap_waterfall.png", "learning_curve.png"]:
                try:
                    shutil.copy(f, artifact_path / f)
                    print(f"Copied {f} to artifact directory.")
                except Exception as cp_err:
                    print(f"Failed to copy {f}: {cp_err}")
                    
        print("\n[SUCCESS] All ML tasks completed successfully!")
        
    finally:
        db.close()

if __name__ == "__main__":
    main()
