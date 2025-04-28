FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY ./frontend/package*.json ./
RUN npm ci
COPY ./frontend ./
RUN npm run build

FROM python:3.10

ENV HOME /root
WORKDIR /root

COPY ./requirements.txt ./requirements.txt
COPY ./server.py ./server.py
COPY ./database.py ./database.py
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY ./backend ./backend

RUN apt update
RUN apt install ffmpeg -y

RUN pip3 install -r requirements.txt

EXPOSE 8080

ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.2.1/wait /wait
RUN chmod +x /wait

CMD /wait && python3 -u server.py
