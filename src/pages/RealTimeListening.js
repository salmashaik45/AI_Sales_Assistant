import React, { useRef, useState, useEffect } from "react";
import Page from "../components/Page";
import Card from "../components/Card";
import { postForm, getCustomerByEmail, getCustomerByPhone, analyzeTextByEmail } from "../api";
import "./RealTimeListening.css";

export default function RealTimeListening({ history, setHistory }) {
  // Recording / transcript state
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("⏹️ Stopped");
  const [transcript, setTranscript] = useState("Waiting for input...");
  const [sentiment, setSentiment] = useState("Neutral");
  const [date, setDate] = useState("");

  // CRM / AI states
  const [lookupValue, setLookupValue] = useState("");
  const [lookupBy, setLookupBy] = useState("email");
  const [customer, setCustomer] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [postSummaryList, setPostSummaryList] = useState([]);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [loadingReco, setLoadingReco] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState("");

  // recorder refs
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  // ----------- Recording logic ------------

  const toggleRecording = async () => {
    if (!recording) {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setStatus("Microphone not available");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        chunksRef.current = [];

        if (typeof MediaRecorder === "undefined") {
          setStatus("MediaRecorder not supported");
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const mr = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        mediaRecorderRef.current = mr;

        mr.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };

        mr.onstop = async () => {
          setStatus("Processing audio...");
          if (!chunksRef.current.length) {
            setTranscript("No speech detected.");
            setSentiment("Neutral");
            setDate(new Date().toLocaleString());
            cleanupMedia();
            return;
          }

          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const formData = new FormData();
          formData.append("file", blob, "recording.webm");

          try {
            const data = await postForm("/analyze-audio", formData);
            const text = data?.text || "No transcription.";
            const s = data?.sentiment || "Neutral";
            setTranscript(text);
            setSentiment(s);
            setDate(new Date().toLocaleString());

            if (setHistory) {
              setHistory((h) => [
                { transcript: text, sentiment: s, date: new Date().toLocaleString() },
                ...(h || []),
              ]);
            }
          } catch (err) {
            console.error("Audio analyze error:", err);
            setTranscript("Error analyzing audio.");
            setSentiment("Error");
            setDate(new Date().toLocaleString());
          } finally {
            cleanupMedia();
          }
        };

        mr.start();
        setRecording(true);
        setStatus("🎤 Listening...");
        setTranscript("Listening...");
      } catch (err) {
        console.error("Mic error:", err);
        setStatus("Microphone access denied");
        cleanupMedia();
      }
    } else {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        } else {
          cleanupMedia();
        }
        setRecording(false);
        setStatus("⏹️ Stopped");
      } catch (err) {
        console.error("Stop error:", err);
        cleanupMedia();
        setStatus("Error stopping");
      }
    }
  };

  const cleanupMedia = () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    } catch (e) {}
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
  };

  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {}
      cleanupMedia();
    };
  }, []);

  // ------------- CRM Lookup --------------
  const handleLookup = async () => {
    setError("");
    setCustomer(null);
    setAiSuggestions("");
    setRecommendations([]);
    if (!lookupValue) {
      setError("Please enter an email or phone number to lookup.");
      return;
    }

    setLoadingLookup(true);
    try {
      let res;
      if (lookupBy === "email") {
        res = await getCustomerByEmail(lookupValue);
      } else {
        res = await getCustomerByPhone(lookupValue);
      }

      if (!res || res.error) {
        setError(res?.error || "Customer not found.");
        setCustomer(null);
      } else {
        setCustomer(res);
      }
    } catch (err) {
      console.error("lookup error:", err);
      setError("Something went wrong while fetching customer.");
    } finally {
      setLoadingLookup(false);
    }
  };

  // -------- Product Recommendation --------
  const handleGenerateRecommendations = async () => {
    if (!customer) return;
    setLoadingReco(true);
    try {
      const prevProducts = customer?.PreviousPurchases
        ? customer.PreviousPurchases.split(",").map((p) => p.trim())
        : [];

      if (prevProducts.length > 0) {
        setRecommendations(
          prevProducts.map((p) => {
            let name = p;
            let desc = `Since the customer purchased ${p}, this product might interest them.`;

            // Example logic for complementary product
            const lower = p.toLowerCase();
            if (lower.includes("bag")) {
              name = "Travel Pillow";
              desc = "Since the customer bought a Bag, a Travel Pillow could be useful for comfort.";
            } else if (lower.includes("grocer")) {
              name = "Snacks & Beverages";
              desc = "Groceries often pair with snacks or beverages that customers may enjoy.";
            } else if (lower.includes("home essentials")) {
              name = "Cleaning Supplies";
              desc = "Home essentials buyers might also need reliable cleaning products.";
            } else if (lower.includes("kitchen")) {
              name = "Cookware Set";
              desc = "Kitchenware customers may also be interested in advanced cookware.";
            } else if (lower.includes("laptop")) {
              name = "Laptop Bag";
              desc = "Since they purchased a Laptop, a protective Laptop Bag could be helpful.";
            } else if (lower.includes("phone")) {
              name = "Phone Case";
              desc = "A Phone purchase often goes with a protective Case.";
            } else if (lower.includes("tablet")) {
              name = "Tablet Stand";
              desc = "A Tablet Stand could improve usability for a Tablet buyer.";
            } else if (lower.includes("shoes")) {
              name = "Shoe Cleaner";
              desc = "Customers buying Shoes may also want Shoe Cleaner or Care Kits.";
            }

            return { name, desc };
          })
        );
      } else {
        setRecommendations([]);
      }
    } catch (err) {
      console.error("recommendation error:", err);
      setRecommendations([]);
    } finally {
      setLoadingReco(false);
    }
  };

  // -------- AI Response --------
  const handleGenerateAIResponse = async () => {
    if (!customer) return;
    setLoadingAI(true);
    try {
      const aiRes = await analyzeTextByEmail(customer.Email || lookupValue);
      if (aiRes?.ai_response) setAiSuggestions(aiRes.ai_response);
    } catch (err) {
      console.warn("AI analyze failed", err);
    } finally {
      setLoadingAI(false);
    }
  };

  // -------- Post Call Summary --------
  const handleGenerateSummary = async () => {
  
  setLoadingSummary(true);
  try {
    const payload = { transcript, sentiment, customer };

    const res = await fetch("http://localhost:8000/generate-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (data?.summary) {
  setPostSummaryList((prev) => [
    ...prev,
    { text: data.summary, date: new Date().toLocaleString() },
  ]);
} else {
  // ✅ Always display fallback summary from backend if available
  setPostSummaryList((prev) => [
    ...prev,
    { text: data.summary || "Summary could not be generated.", date: new Date().toLocaleString() },
  ]);
}

  } catch (err) {
    console.error("summary error", err);
    setPostSummaryList((prev) => [
      ...prev,
      { text: "Error generating summary.", date: new Date().toLocaleString() },
    ]);
  } finally {
    setLoadingSummary(false);
  }
};


  // -------- Open AI Response Sheet --------
  const openAIResponseSheet = () => {
    window.open(
      "https://docs.google.com/spreadsheets/d/1eattCsIt1yytAWgc8I3qWfqIuJ3cQYY_3jYsmaBYOhE/edit?gid=0#gid=0",
      "_blank"
    );
  };

  const phoneOrEmailPlaceholder = lookupBy === "email" ? "customer@example.com" : "+91 98765 43210";

  return (
    <Page title="🎤 Real-Time Listening" subtitle="Record -> CRM -> Recommendations -> Post-Call Summary">
      <div className="rt-container">

        {/* Controller Card */}
        <Card title="Controller" subtitle="Start/Stop recording & live transcript">
          <div className="ctrl-row">
            <div>
              <button className="btn primary" onClick={toggleRecording}>
                {recording ? "Stop Call" : "Start Call"}
              </button>
              <button className="btn ghost" onClick={() => { setTranscript("Waiting for input..."); setSentiment("Neutral"); setDate(""); }}>
                Clear
              </button>
            </div>
            <div className="status-pill">Status: <strong>{status}</strong></div>
          </div>

          <div className="transcript-block">
            <div className="transcript-header">
              <h4>Transcript</h4>
              <span className="muted">{date}</span>
            </div>
            <div className="transcript-body">{transcript}</div>

            <div className="sentiment-row">
              <div className={`sentiment-badge ${sentiment.toLowerCase()}`}>Sentiment: <strong>{sentiment}</strong></div>
              <button className="btn small" onClick={handleGenerateSummary} disabled={loadingSummary}>
                {loadingSummary ? "Summarizing..." : "Generate Post-Call Summary"}
              </button>
            </div>
          </div>
        </Card>

         



                 {/* Insight Generation Box */}
        <Card title="🔍 Insight Generation" subtitle="AI-driven, multi-sentence call insights">
          <div className="insight-box">
            <button
              className="btn primary"
              onClick={() => {
                // Helper: choose best template based on transcript + sentiment
                const text = (transcript || "").toLowerCase();

                // detect conditions (simple heuristics; extend as needed)
                const contains = (arr) => arr.some((k) => text.includes(k));
                const droppedKeywords = ["dropped", "disconnected", "call cut", "hang up", "left the call"];
                const recommendKeywords = ["recommend", "suggest", "which one", "what should i", "advice"];
                const purchaseKeywords = ["buy", "purchase", "order", "i'll buy", "i want to buy", "i want to order"];
                const confusionKeywords = ["don't know", "dont know", "confused", "not sure", "unclear", "lack of clarity", "price?"];
                const negativeKeywords = ["not good", "bad", "didn't like", "dont like", "won't"]

                const isDropped = contains(droppedKeywords);
                const askedRecommend = contains(recommendKeywords);
                const hasPurchaseIntent = contains(purchaseKeywords);
                const isConfused = contains(confusionKeywords);
                const hasNegative = contains(negativeKeywords) || (sentiment || "").toLowerCase().includes("negative");

                const isPositive = (sentiment || "").toLowerCase().includes("positive");
                const isNeutral = (sentiment || "").toLowerCase().includes("neutral");

                // Build dynamic content snippets
                const custName = (customer && (customer.Name || customer.Email || customer.Phone)) ? (customer.Name || customer.Email || customer.Phone) : "The customer";
                const topReco = (recommendations && recommendations.length > 0) ? recommendations[0].name + " — " + recommendations[0].desc : null;

                // Templates (multi-sentence)
                const templates = {
                  positive: [
                    `The customer expressed strong positive sentiment and appeared genuinely satisfied with the product features discussed. This suggests high potential for repeat purchases and brand advocacy.`,
                    `Follow up with a personalized thank-you message and invite them to leave a review—social proof will amplify conversions.`,
                    topReco ? `Recommended next step: propose a complementary product such as ${topReco} tailored to their recent interest.` : `Recommended next step: offer a helpful cross-sell or premium upgrade that matches their expressed needs.`
                  ].join(" "),
                  dropped: [
                    `The call ended unexpectedly and the customer disconnected mid-conversation, likely before a decision could be reached.`,
                    `Because the discussion included product recommendations, it's important to re-engage promptly. Reach out using the same channel (or SMS/email) within 24 hours and reference the key points discussed to rebuild continuity.`,
                    `Recommended tactic: offer a brief summary of the missed items and include a limited-time incentive to encourage completion of the purchase.`
                  ].join(" "),
                  recommend: [
                    `The customer explicitly asked for product recommendations during the call. They are in the consideration stage and may need curated options to convert.`,
                    `The sales team should send a tailored list (top 3 items) highlighting why each fits their use-case, plus short testimonials or a one-minute demo video link.`,
                    topReco ? `Try leading with ${topReco} as the first suggestion, then provide 1–2 alternatives.` : `Provide 2–3 hand-picked options and a clear next action (buy link, trial, or callback).`
                  ].join(" "),
                  confusion: [
                    `The conversation contained indicators of confusion or lack of clarity around features/pricing. This is a sign that product messaging might be too technical or unclear in this case.`,
                    `Follow up with a concise comparison sheet, a short explainer video, or a friendly demo to clarify differences and benefits.`,
                    `Also, train agents to simplify explanations into tangible benefits (how it saves time or money) to reduce friction on future calls.`
                  ].join(" "),
                  negative: [
                    `The call reflected dissatisfaction or complaint, and the customer sounded unhappy with some aspect of the product/service.`,
                    `Prioritize a quick support outreach that acknowledges the issue, apologizes, and offers a concrete remediation or compensation where appropriate.`,
                    `Turning this negative into a solved case can recover trust—and at times create a strong retention story if handled promptly and empathetically.`
                  ].join(" "),
                  neutral: [
                    `The conversation had a neutral tone with informative exchange but no clear purchase trigger.`,
                    `To increase engagement, schedule a short follow-up that includes targeted product benefits, one or two tailored recommendations, and social proof.`,
                    `A gentle nudge (promo code or helpful content) often moves neutral leads toward conversion.`
                  ].join(" "),
                  fallback: [
                    `The call has ended. Based on the transcript and sentiment, additional inspection could yield a more targeted next step.`,
                    `Consider using the generated post-call summary and any CRM history to craft a personalized follow-up message.`
                  ].join(" ")
                };

                // Decision logic (priority order)
                let insightText = "";
                if (isDropped) {
                  insightText = templates.dropped;
                } else if (hasNegative) {
                  insightText = templates.negative;
                } else if (askedRecommend) {
                  insightText = templates.recommend;
                } else if (hasPurchaseIntent) {
                  // purchase intent -> treat similar to positive but with action to close sale
                  insightText = [
                    `The customer signaled purchase intent during the conversation—this is a warm lead.`,
                    `The sales team should act quickly with a personalized offer, payment options, or a small limited-time discount to close the sale.`,
                    topReco ? `Suggested offer: bundle ${topReco} with a small discount or free shipping.` : `Suggested offer: provide a simple, clear purchase link and confirm availability.`
                  ].join(" ");
                } else if (isConfused) {
                  insightText = templates.confusion;
                } else if (isPositive) {
                  insightText = templates.positive;
                } else if (isNeutral) {
                  insightText = templates.neutral;
                } else {
                  insightText = templates.fallback;
                }

                // Add a short actionable checklist or next steps
                const nextSteps = [
                  "1) Send a personalized follow-up referencing the call highlights.",
                  "2) Attach 1–2 curated product links or a one-minute demo.",
                  "3) Offer a limited-time incentive if appropriate (discount / free shipping).",
                  "4) Log the interaction in CRM with tags: follow-up, recommendation, purchase-intent."
                ].join(" ");

                // Final output: add customer name if available
                const finalOutput = (custName ? `${custName}: ` : "") + insightText + "\n\n" + "Suggested Next Steps:\n" + nextSteps;

                // Render to DOM
                const box = document.getElementById("insight-output");
                if (box) {
                  box.style.display = "block";
                  box.querySelector("p").textContent = finalOutput;
                }
              }}
            >
              Generate Insights
            </button>

            <div id="insight-output" className="insight-output" style={{ display: "none", marginTop: "15px" }}>
              <p style={{ whiteSpace: "pre-wrap", background: "var(--card-bg)", padding: "15px", borderRadius: "10px" }}></p>
            </div>
          </div>
        </Card>




        {/* CRM Lookup Card */}
        <Card title="🔎 CRM Lookup" subtitle="Enter customer email / phone to fetch profile & suggestions">
          <div className="lookup-row">
            <div className="toggle-group">
              <label className={`toggle ${lookupBy === "email" ? "active" : ""}`}>
                <input type="radio" checked={lookupBy === "email"} onChange={() => setLookupBy("email")} />
                Email
              </label>
              <label className={`toggle ${lookupBy === "phone" ? "active" : ""}`}>
                <input type="radio" checked={lookupBy === "phone"} onChange={() => setLookupBy("phone")} />
                Phone
              </label>
            </div>

            <div className="lookup-inputs">
              <input className="input" placeholder={phoneOrEmailPlaceholder} value={lookupValue} onChange={(e) => setLookupValue(e.target.value)} />
              <button className="btn primary" onClick={handleLookup} disabled={loadingLookup}>
                {loadingLookup ? "Looking up..." : "Lookup"}
              </button>
            </div>
          </div>

          {error && <div className="error">{error}</div>}

          {customer && (
            <div className="customer-card">
              <div className="customer-left">
                <h4>{customer.Name || "Unknown"}</h4>
                <p className="muted small">{customer.Email || customer.Phone}</p>
                <p><strong>Last Bought:</strong> {customer.Product || "—"}</p>
                <p><strong>Previous Purchases:</strong> {customer.PreviousPurchases || "—"}</p>
                <p><strong>Notes:</strong> {customer.Notes || customer["Call Feedback"] || "—"}</p>
              </div>
            </div>
          )}
        </Card>

        {/* AI Suggestions Card */}
        <Card title="💡 AI Suggestions" subtitle="Recommendations & insights">
          <div className="ai-dynamic">
            <div className="ai-suggestion-main">
              <h4>Personalized AI Response</h4>
              <div className="ai-response-block">
                {aiSuggestions ? <p className="ai-text">{aiSuggestions}</p> : <p className="muted">No AI analysis yet. Lookup a customer first.</p>}
              </div>

              <div className="action-buttons">
                <button className="btn small" onClick={handleGenerateAIResponse} disabled={loadingAI}>
                  {loadingAI ? "Generating..." : "Generate AI Response"}
                </button>
                <button className="btn small" onClick={handleGenerateRecommendations} disabled={loadingReco}>
                  {loadingReco ? "Loading..." : "Get Product Recommendations"}
                </button>
                {/* Open AI Response Sheet Button */}
                <button className="btn small ghost" onClick={openAIResponseSheet}>
                  Open AI Response Sheet
                </button>
              </div>

              <div className="reco-row">
                <h5>Recommendations</h5>
                {loadingReco ? <p className="muted">Loading recommendations...</p> :
                  recommendations && recommendations.length ? (
                    <ul className="reco-list">
                      {recommendations.map((r, i) => (
                        <li key={i} className="reco-item">
                          <div>
                            <strong>{r.name}</strong>
                            <div className="muted small">{r.desc}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="muted">No recommendations available.</p>
                }
              </div>
            </div>
          </div>
        </Card>

        {/* Post-Call Summaries */}
        <Card title="📝 Post-Call Summaries" subtitle="Generated insights">
          {postSummaryList.length === 0 && <p className="muted">No summaries generated yet.</p>}
          {postSummaryList.map((p, idx) => (
            <div key={idx} className="summary-card">
              <h4>Summary #{idx + 1}</h4>
              <p>{p.text}</p>
              <span className="muted small">{p.date}</span>
            </div>
          ))}
        </Card>

      </div>
    </Page>
  );
}
