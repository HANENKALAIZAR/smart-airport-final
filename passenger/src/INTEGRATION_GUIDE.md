# Guide d'intégration — Nouveau UI ↔ Backend FastAPI

## Fichiers à copier dans votre nouveau frontend (ai-flight-aid-main)

### 1. Nouveau fichier (créer)
```
src/services/api.ts   ← Service API complet avec adaptateur
```

### 2. Fichiers remplacés
```
src/pages/Flights.tsx      ← Connecté à GET /api/flights
src/pages/FlightDetail.tsx ← Connecté à GET /api/flights/{id} + prédiction SHAP
```

## Configuration

Créez un fichier `.env` à la racine du nouveau frontend :
```
VITE_API_URL=http://localhost:8000/api
```

## Comment ça marche

- Si le backend FastAPI est lancé → données réelles
- Si le backend est éteint → fallback automatique sur mockFlights.ts
- Rafraîchissement automatique toutes les 30 secondes
- Prédictions SHAP affichées avec barres visuelles dans FlightDetail

## Lancer le backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Vérifier que ça marche

Ouvrir : http://localhost:8000/docs
Vous devez voir les endpoints :
- GET /api/flights
- GET /api/flights/{id}
- GET /api/flights/{id}/prediction
- GET /api/opensky/states
