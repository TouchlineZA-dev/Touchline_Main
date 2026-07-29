
(async () => {
    try {
        const baseUrl = process.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
        const url = `${baseUrl.replace(/\/$/, "")}/news/headlines?max=5`;
        console.log(`Fetching: ${url}`);
        const res = await fetch(url);
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Body:", text);
    } catch (e) {
        console.error("Error:", e);
    }
})();
