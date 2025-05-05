import "../styles/profile.css";
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

// 成就类型定义
type Achievement = {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  progress: number;
  icon: string;
};

export default function UserProfile() {
  const [image, setImage] = useState<File | null>(null);
  const [imageURL, setImageURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [stats, setStats] = useState({
    highScore: 0,
    avgSurvivalTime: 0,
    longestSnake: 0,
    totalFood: 0,
    totalKills: 0
  });
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch user profile info
    const fetchUserData = async () => {
      try {
        const response = await fetch('/user/current', {
          credentials: 'include',
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUsername(userData.username);
        } else {
          navigate('/login');
        }
      } catch (error) {
        navigate('/login');
      }
    };

    // Save the player's current game stats when navigating to profile
    const savePlayerStats = async () => {
      try {
        // Get game data from sessionStorage if available
        const gameDataStr = sessionStorage.getItem('gameData');
        if (gameDataStr) {
          const gameData = JSON.parse(gameDataStr);
          
          // Calculate time played in seconds from the start time
          const startTime = gameData.startTime || Date.now();
          const survivalTime = (Date.now() - startTime) / 1000; // in seconds
          
          // Prepare data to save
          const statsData = {
            score: gameData.score || 0,
            length: gameData.length || 1,
            survivalTime: survivalTime,
            foodEaten: gameData.foodEaten || 0,
            kills: gameData.kills || 0
          };
          
          // Save the stats to the server
          await fetch('/user/save-stats', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(statsData),
          });
          
          // Clear game data since we're leaving the game
          sessionStorage.removeItem('gameData');
        }
      } catch (err) {
        console.error("Error saving game stats:", err);
      }
    };

    // Fetch avatar
    const fetchAvatar = async () => {
      try {
        const response = await fetch('/user/avatar', {
          method: 'GET',
          credentials: 'include',
        });
        if (response.ok) {
          const { url } = await response.json();
          setImageURL(url);
        } else {
          console.error("Failed to load avatar");
        }
      } catch (err) {
        console.error("Network error while loading avatar:", err);
      }
    };

    // Fetch player stats
    const fetchPlayerStats = async () => {
      try {
        const response = await fetch('/user/stats', {
          credentials: 'include',
        });
        
        if (response.ok) {
          const statsData = await response.json();
          setStats({
            highScore: statsData.highScore || 0,
            avgSurvivalTime: statsData.avgSurvivalTime || 0,
            longestSnake: statsData.longestSnake || 0,
            totalFood: statsData.totalFood || 0,
            totalKills: statsData.totalKills || 0
          });
        } else {
          console.error("Failed to load player stats");
        }
      } catch (err) {
        console.error("Network error while loading stats:", err);
      }
    };

    // Fetch player achievements
    const fetchAchievements = async () => {
      try {
        const response = await fetch('/user/achievements', {
          credentials: 'include',
        });
        
        if (response.ok) {
          const achievementsData = await response.json();
          setAchievements(achievementsData);
        } else {
          console.error("Failed to load achievements");
        }
      } catch (err) {
        console.error("Network error while loading achievements:", err);
      }
    };

    // Run the functions in sequence
    const initializeProfile = async () => {
      await fetchUserData();
      await savePlayerStats(); // Save current game stats first
      await fetchAvatar();
      await fetchPlayerStats(); // Then fetch updated stats
      await fetchAchievements(); // Finally fetch achievements which depend on stats
    };

    initializeProfile();
  }, [navigate]);

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
        if (updated?.url) {
          // 添加时间戳参数防止浏览器缓存
          const cacheBuster = '?t=' + new Date().getTime();
          setImageURL(updated.url + cacheBuster);
        }
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

  // Format time from seconds to MM:SS
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Handler for returning to game - this will reset game state
  const handleReturnToGame = () => {
    // Clear any game session data to ensure a fresh start
    sessionStorage.removeItem('gameData');
    // Navigate to game page
    window.location.href = '/game';
  };

  // Calculate number of unlocked achievements
  const unlockedCount = achievements.filter(achievement => achievement.unlocked).length;
  const achievementCount = achievements.length;

  return (
    <div className="profile-page">
      <h1 className="profile-title">Player Profile</h1>
      
      <div className="profile-card">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="profile-content">
          <div className="avatar-section">
            <h2>{username}'s Profile</h2>
            <div className="avatar-container">
              {imageURL ? (
                <img
                  src={imageURL}
                  alt="User Avatar"
                  className="profile-avatar"
                />
              ) : (
                <div className="profile-avatar-placeholder">No Avatar</div>
              )}
            </div>

            <form onSubmit={handleSubmit} encType="multipart/form-data" className="avatar-form">
              <div className="form-field">
                <label htmlFor="image" className="form-field-label">Change Avatar</label>
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
                />
              </div>

              <button type="submit" className="profile-btn upload-btn">
                Upload
              </button>
            </form>
          </div>

          <div className="stats-section">
            <h2>Player Statistics</h2>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-label">High Score</div>
                <div className="stat-value">{stats.highScore}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Longest Snake</div>
                <div className="stat-value">{stats.longestSnake} segments</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Average Survival</div>
                <div className="stat-value">{formatTime(stats.avgSurvivalTime)}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Food Eaten</div>
                <div className="stat-value">{stats.totalFood}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Player Kills</div>
                <div className="stat-value">{stats.totalKills}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Achievements Section */}
        <div className="achievements-section">
          <h2>Achievements ({unlockedCount}/{achievementCount})</h2>
          <div className="achievements-grid">
            {achievements.map((achievement) => (
              <div 
                key={achievement.id} 
                className={`achievement-item ${achievement.unlocked ? 'achievement-unlocked' : 'achievement-locked'}`}
              >
                {achievement.unlocked && (
                  <div className="achievement-unlock-badge">✓</div>
                )}
                <div className="achievement-icon">
                  {achievement.icon}
                </div>
                <div className="achievement-name">
                  {achievement.name}
                </div>
                <div className="achievement-description">
                  {achievement.description}
                </div>
                <div className="achievement-progress-container">
                  <div 
                    className="achievement-progress" 
                    style={{ width: `${achievement.progress}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="profile-btn return-btn"
          onClick={handleReturnToGame}
          style={{ marginTop: "2rem" }}
        >
          Return to Game
        </button>
      </div>
    </div>
  );
}