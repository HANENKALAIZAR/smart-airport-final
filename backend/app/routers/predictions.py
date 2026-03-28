"""
Predictions API router.
All prediction endpoints require admin or super_admin authentication.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.models import FlightFeature, User
from app.schemas.schemas import PredictionOut, PredictionRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/predictions", tags=["Predictions"])


@router.post("", response_model=PredictionOut)
def predict_from_features(
    request: PredictionRequest,
    _user: User = Depends(require_admin),
):
    """
    Generate a prediction from raw features.
    Requires admin or super_admin JWT token.
    Responses are cached for 5 minutes per unique feature set.
    """
    from app.services.prediction_service import predict_from_dict
    logger.info(f"Prediction requested by user id={_user.id}")
    return predict_from_dict(request.model_dump())


@router.post("/batch", response_model=list[PredictionOut])
def batch_predict(
    flight_ids: list[int],
    db: Session = Depends(get_db),
    _user: User = Depends(require_admin),
):
    """Generate predictions for multiple DB flights. Requires admin JWT."""
    from app.services.prediction_service import predict_flight
    results = []
    for fid in flight_ids:
        feat = db.query(FlightFeature).filter(FlightFeature.flight_id == fid).first()
        if feat:
            results.append(predict_flight(feat))
    return results
