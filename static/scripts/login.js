document.getElementById("login").addEventListener("submit", async function(e) {
    e.preventDefault();

    const form = e.target;

    const formData = new FormData(form);
    const data = new URLSearchParams(formData);

    try {
        const response = await fetch("/auth/login", {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: data
        });

        if(response.ok) {
            window.location.href = "/";
        }
        else {
            const errorText = await response.text();
            alert("Login failed: " + errorText);
        }
    }
    catch(err) {
        alert("Network error: " + err.message);
    }
})