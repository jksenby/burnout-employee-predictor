import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const ProfilePage = () => {
  const { user, token } = useAuth();

  const [formData, setFormData] = useState({
    gender: "",
    phone_number: "",
    age: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (user) {
      setFormData({
        gender: user.gender || "",
        phone_number: user.phone_number || "",
        age: user.age || "",
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const res = await fetch("http://localhost:8000/auth/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          gender: formData.gender,
          phone_number: formData.phone_number,
          age: Number(formData.age),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to update profile");
      }

      setMessage({ type: "success", text: "Profile updated successfully!" });
      // In a real app we might also update the user object in context here by calling a refresh on /me
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
      setTimeout(() => {
        setMessage({ type: "", text: "" });
      }, 3000);
    }
  };

  return (
    <div className="page-wrapper profile-page">
      <div className="page-header">
        <h1>Your Profile</h1>
        <p className="subtitle">Update your personal information below</p>
      </div>

      <div className="profile-card">
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-group row">
            <div className="col">
              <label>Username</label>
              <input
                type="text"
                value={user?.username || ""}
                disabled
                className="input-disabled"
              />
            </div>
            <div className="col">
              <label>Email</label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="input-disabled"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="gender">Gender</label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              required
              className="form-input"
            >
              <option value="" disabled>
                Select gender
              </option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group row">
            <div className="col">
              <label htmlFor="phone_number">Phone Number</label>
              <input
                id="phone_number"
                name="phone_number"
                type="tel"
                value={formData.phone_number}
                onChange={handleChange}
                required
                className="form-input"
              />
            </div>
            <div className="col">
              <label htmlFor="age">Age</label>
              <input
                id="age"
                name="age"
                type="number"
                min="1"
                max="120"
                value={formData.age}
                onChange={handleChange}
                required
                className="form-input"
              />
            </div>
          </div>

          {message.text && (
            <div className={`form-message ${message.type}`}>{message.text}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="button profile-submit"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
