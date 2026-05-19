# Retail Demand Intelligence

## What it does

Retail Demand Intelligence forecasts SKU demand, estimates inventory risk, and produces LLM-generated explanations for operational decisions.

## Stack

Prophet + LightGBM for forecasting, FastAPI for the backend API, and Next.js for the frontend dashboard.

## Quick Start

```bash
git clone <repo-url>
cd retail-demand-intelligence
pip install -r requirements.txt
uvicorn api.main:app
```
