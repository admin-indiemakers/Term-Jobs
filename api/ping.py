from fastapi import FastAPI

app = FastAPI()

@app.get("/api/ping")
@app.get("/ping")
def ping():
    return {"status": "ok", "message": "serverless function is operational"}
