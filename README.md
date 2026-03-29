# 🤖 AI Sales Call Assistant

An AI-powered sales assistant that analyzes customer conversations (text or voice) to detect sentiment and tone, and logs insights into Google Sheets for tracking and analysis.

---

## 🚀 Features

- 🎙️ Real-time sentiment analysis (Positive / Negative / Neutral)
- 🧠 Tone detection (Friendly, Angry, Upset, Polite, Neutral)
- 🗣️ Supports both text and voice input
- 📊 Automatic logging into Google Sheets
- 📅 Stores transcript, sentiment, tone, and timestamp

---

## 🛠️ Tech Stack

- **Frontend:** React (CSS)
- **Backend:** FastAPI (Python)
- **AI Model:** Groq LLaMA
- **Database:** Google Sheets API

---

## 📊 How It Works

1. User inputs text or voice  
2. Backend processes input and sends it to the AI model  
3. AI returns sentiment and tone analysis  
4. Results are stored and logged into Google Sheets  
5. Data can be accessed anytime for insights  

---

## 👩‍💻 My Contribution

This project was developed as part of the **Infosys Springboard Virtual Internship 6.0** as a team project.

### My contributions include:

- Participated in initial system architecture planning  
- Maintained Agile documentation and tracked team progress  
- Supported testing and coordination during development  

---

## 📝 Note

This repository is a fork of the original team project.

The original implementation was primarily developed by the team lead.

---

## ⚙️ Setup Instructions

### 🔹 Backend Setup

```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create a .env file and add:

```
GROQ_API_KEY=your_api_key_here
```

Add your Google service account file (cred.json) to the backend folder.

Update your Google Sheet ID in the code:

```
SHEET_ID = "your_google_sheet_id_here"
```

Run the backend:

```
uvicorn main:app --reload
```

### 🔹 Frontend Setup

```
cd frontend
npm install
npm start
```

## 📄 License

This project is licensed under the MIT License.

## 🙌 Acknowledgement

Developed as part of the Infosys Springboard Virtual Internship 6.0 program.
Special thanks to the team members and mentor for guidance and collaboration.