# CSE312-Project

## Link to Public Deployment
[wigglewars.me](https://wigglewars.me)

## Setup Instructions
### To start web app:
- Create a new venv by running ```python3 -m venv .venv```
- Activate venv by running
  - On MacOS/Unix: ```source .venv/bin/activate```
  - On Windows: ```.venv\Scripts\activate.bat```
- Run ```docker compose up --build -d```
- Visit [http://localhost:8080](http://localhost:8080) in your browser
### When you are finished:
- Run ```docker compose down```
- Deactivate venv by running ```deactivate```
