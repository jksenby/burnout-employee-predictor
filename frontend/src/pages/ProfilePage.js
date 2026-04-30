import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

const ProfilePage = () => {
  const { t } = useTranslation();
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
        throw new Error(data.detail || t("profile.fail_update"));
      }

      setMessage({ type: "success", text: t("profile.success_update") });
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
        <h1>{t("profile.title")}</h1>
        <p className="subtitle">{t("profile.subtitle")}</p>
      </div>

      <div className="profile-card">
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-group row">
            <div className="col">
              <label>{t("profile.username")}</label>
              <input
                type="text"
                value={user?.username || ""}
                disabled
                className="input-disabled"
              />
            </div>
            <div className="col">
              <label>{t("profile.email")}</label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="input-disabled"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="gender">{t("profile.gender")}</label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              required
              className="form-input"
            >
              <option value="" disabled>
                {t("profile.select_gender")}
              </option>
              <option value="Male">{t("profile.male")}</option>
              <option value="Female">{t("profile.female")}</option>
              <option value="Other">{t("profile.other")}</option>
            </select>
          </div>

          <div className="form-group row">
            <div className="col">
              <label htmlFor="phone_number">{t("profile.phone")}</label>
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
              <label htmlFor="age">{t("profile.age")}</label>
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
            {loading ? t("profile.saving") : t("profile.save_btn")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
