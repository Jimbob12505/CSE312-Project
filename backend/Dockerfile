
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY wait-for-it.sh .

COPY server.py .

RUN chmod +x wait-for-it.sh

CMD ["gunicorn", "-b", "0.0.0.0:5000", "app:app"]
