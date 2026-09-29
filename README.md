# AuraMed

Clinical decision support platform for women's health screening across three modules: **breast cancer**, **cervical cancer**, and **PCOS**. Doctors upload scans and clinical data, AuraMed combines deep-learning image models with validated clinical formulas, and produces risk scores, reasoning, trajectories, and PDF reports. Patients get their own portal.

## Stack

- **Frontend**: React 18, Vite, Tailwind CSS, React Router, Axios, Recharts, Lucide React
- **Backend**: FastAPI, Uvicorn, SQLAlchemy, Alembic, PostgreSQL (or SQLite for local dev), JWT auth
- **ML**: PyTorch — ResNet-50 (breast, PCOS), ViT-Base-Patch16-224 (cervical cytology)

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ *(only for the full/Docker setup — the quick local run uses SQLite)*

---

## Quick start (local, no PostgreSQL)

This runs the real FastAPI app against a local SQLite database with demo accounts pre-seeded.

### 1. Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
python tests/run_sqlite_server.py
```

Backend: http://127.0.0.1:8000 · API docs: http://127.0.0.1:8000/docs

### 2. Frontend (new terminal)

```bash
cd frontend
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run dev
```

Open http://localhost:5173

### One-click launcher (Windows)

After both setups above have been done once, double-click **`start.bat`** (or run `start.ps1`) in the project root. It frees ports 8000/5173, starts backend and frontend, and opens the browser.

---

## Full setup (PostgreSQL)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # or: source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env              # set DATABASE_URL and SECRET_KEY
alembic upgrade head              # create tables
python seed_db.py                 # seed demo accounts/data
uvicorn app.main:app --reload --port 8000
```

Then run the frontend as above.

### Docker

```bash
cp .env.example .env
docker-compose up --build
```

Starts PostgreSQL, the backend (port 8000) and the frontend (port 5173).

---

## Demo logins

| Role    | Email                   | Password    |
|---------|-------------------------|-------------|
| Doctor  | `dr.mehta@auramed.com`  | `Doctor@123` |
| Doctor  | `doctor@auramed.com`    | `123`       |
| Admin   | `admin@auramed.com`     | `123`       |
| Patient | `patient@auramed.com`   | `123`       |

Sample scans for trying each module are in `demo_data/{breast,cervical,pcos}`.

---

## Model weights

Trained weights (`*.pth`) are **not included in this repository** because of their size.

- **Without weights**, AuraMed runs in *formula-only mode* — all clinical formula features work; image-model predictions are disabled.
- **To enable the image models**, place these files in `backend/app/ml/weights/` (the `*_metadata.json` files are already there):
  - `breast_model.pth`
  - `cervical_model.pth`
  - `pcos_model.pth`

You can produce them yourself with the training pipeline:

```bash
cd training
python -m venv .venv_train
.venv_train\Scripts\activate      # or: source .venv_train/bin/activate
pip install -r requirements_training.txt

python breast/train.py
python cervical/train.py
python pcos/train.py

python copy_weights.py            # copies training/weights -> backend/app/ml/weights
```

See [`training/README_training.md`](training/README_training.md) for datasets, arguments, evaluation and calibration.

---

## Tests

```bash
cd backend
pytest tests
```

---

## Project structure

```
auramed/
  backend/
    app/
      api/routes/      # FastAPI routes
      core/            # config, DB, security
      models/          # SQLAlchemy models
      schemas/         # Pydantic schemas
      services/        # business logic, PDF, email
      ml/              # breast / cervical / pcos models, formulas, fusion, reasoning
    alembic/           # migrations
    tests/             # test suite + run_sqlite_server.py (local dev server)
  frontend/
    src/
      components/{common,admin,doctor,patient}/
      pages/{admin,doctor,patient,public}/
      context/  hooks/  services/  utils/
  training/            # model training, evaluation, calibration, export
  demo_data/           # sample scans per module
  docker-compose.yml
  start.bat / start.ps1
```

## Environment variables

See `backend/.env.example` and `frontend/.env.example`. Key backend values:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing key (32+ chars) |
| `*_MODEL_PATH` | Paths to the three model weight files |
| `SMTP_*`, `FROM_*` | Outgoing email (optional) |
| `CORS_ORIGINS` | Allowed frontend origins |

## Color palette

| Role       | Hex       |
|------------|-----------|
| Primary (Navy) | `#0A1628` |
| Accent (Teal)  | `#0D9488` |
| Success    | `#16A34A` |
| Warning    | `#D97706` |
| Danger     | `#DC2626` |
| Background | `#F8FAFC` |

> **Disclaimer:** AuraMed is a research/educational decision-support prototype and is not a certified medical device.
