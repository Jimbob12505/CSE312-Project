document.getElementById("register").addEventListener("submit", async function(e) {
    e.preventDefault();

    const form = e.target;
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;

    if(password != confirmPassword) {
        alert("Passwords do not match");
        return;
    }

    const formData = new FormData(form);
    const data = new URLSearchParams(formData);

    try {
        const response = await fetch("/auth/register", {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: data
        });

        if(response.ok) {
            window.location.href = "/";
        }
        else {
            const errorText = await response.text();
            alert("Signup failed: " + errorText);
        }
    }
    catch(err) {
        alert("Network error: " + err.message);
    }
})