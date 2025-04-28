FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY docker-nginx/html/frontend ./
RUN npm run build

FROM python:3.10

ENV HOME /root
WORKDIR /root

COPY docker-nginx/html/requirements.txt ./requirements.txt
COPY docker-nginx/html/server.py ./server.py
COPY docker-nginx/html/database.py ./database.py
COPY docker-nginx/html/game_websocket.py ./game_websocket.py
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY docker-nginx/html/frontend/app ./frontend/app
COPY docker-nginx/html/backend ./backend

RUN apt update
RUN apt install ffmpeg -y

RUN pip3 install -r requirements.txt

EXPOSE 8080

ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.2.1/wait /wait
RUN chmod +x /wait

CMD /wait && python3 -u server.py
