import "../styles/login.css";
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function UploadAvatar() {
  const [image, setImage] = useState<File | null>(null);
  const [imageURL, setImageURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAvatar = async () => {
      try {
        const response = await fetch('/user/avatar', {
          method: 'GET',
          credentials: 'include',
        });
        if (response.ok) {
          const { url } = await response.json(); // Assuming backend returns { url: "..." }
          setImageURL(url);
        } else {
          console.error("Failed to load avatar");
        }
      } catch (err) {
        console.error("Network error while loading avatar:", err);
      }
    };

    fetchAvatar();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!image) {
      setError("Please select an image.");
      return;
    }

    const formData = new FormData();
    formData.append("image", image);

    try {
      const response = await fetch('/user/avatar', {
        method: 'PUT',
        credentials: 'include',
        body: formData,
      });

      if (response.ok) {
        setSuccess("Avatar uploaded successfully.");
        // Re-fetch updated image
        const updated = await response.json();
        if (updated?.url) setImageURL(updated.url);
      } else {
        const errorText = await response.text();
        setError(errorText || "Upload failed");
        console.error("Upload failed:", errorText);
      }
    } catch (error) {
      console.error("Network error:", error);
      setError("Network error. Please try again.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-content">
        <h1 className="login-title">Upload Avatar</h1>

        <div className="form-container">
          <div className="form-content">
            <div className="tab-container">
              <Link to="/game" className="tab-button inactive">Back</Link>
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="image-slot" style={{ marginBottom: '1rem' }}>
              <p>Current Avatar:</p>
              {imageURL ? (
                <img
                  src={imageURL}
                  alt="User Avatar"
                  style={{ maxWidth: '200px', borderRadius: '8px' }}
                />
              ) : (
                <p>No avatar uploaded</p>
              )}
            </div>

            <form onSubmit={handleSubmit} encType="multipart/form-data">
              <div className="form-field">
                <label htmlFor="image" className="form-field-label">Upload New Image</label>
                <input
                  id="image"
                  type="file"
                  accept="image/*"
                  className="form-input"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setImage(e.target.files[0]);
                    }
                  }}
                  required
                />
              </div>

              <button type="submit" className="form-submit" style={{ marginTop: '1rem' }}>
                Upload
              </button>
              <button
                type="button"
                className="form-submit"
                style={{ backgroundColor: '#ccc', color: '#000' }}
                onClick={() => navigate('/game')}>
                Continue to game
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}