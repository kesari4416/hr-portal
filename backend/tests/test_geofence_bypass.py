"""Tests for geofence bypass feature and check-location endpoint"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ADMIN_EMAIL = "ponish.jino@sparkcurv.com"
ADMIN_PASSWORD = "Aiden@1996"

# Nagercoil HQ coords
HQ_LAT = 8.1815
HQ_LNG = 77.4294

# Remote coords (Madurai)
REMOTE_LAT = 9.9252
REMOTE_LNG = 78.1198


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    resp = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return s


@pytest.fixture(scope="module")
def original_settings(admin_session):
    resp = admin_session.get(f"{BASE_URL}/api/admin/office-settings")
    assert resp.status_code == 200
    return resp.json()


class TestOfficeSettings:
    def test_get_office_settings(self, admin_session):
        resp = admin_session.get(f"{BASE_URL}/api/admin/office-settings")
        assert resp.status_code == 200
        data = resp.json()
        assert "latitude" in data
        assert "longitude" in data
        assert "radius_km" in data
        assert "geofence_bypass" in data
        print(f"Office settings: {data}")

    def test_enable_geofence_bypass(self, admin_session, original_settings):
        payload = {
            "latitude": original_settings["latitude"],
            "longitude": original_settings["longitude"],
            "radius_km": original_settings["radius_km"],
            "office_name": original_settings.get("name", "Main Headquarters (Nagercoil)"),
            "address": original_settings.get("address", ""),
            "geofence_bypass": True
        }
        resp = admin_session.put(f"{BASE_URL}/api/admin/office-settings", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("geofence_bypass") == True
        print("Geofence bypass enabled successfully")

    def test_get_settings_bypass_is_true(self, admin_session):
        resp = admin_session.get(f"{BASE_URL}/api/admin/office-settings")
        assert resp.status_code == 200
        data = resp.json()
        assert data["geofence_bypass"] == True, f"Expected bypass=True but got {data['geofence_bypass']}"
        print("Verified geofence_bypass persisted as True")


class TestCheckLocation:
    def test_check_location_hq_always_within(self, admin_session):
        resp = admin_session.post(f"{BASE_URL}/api/attendance/check-location",
                                  json={"latitude": HQ_LAT, "longitude": HQ_LNG})
        assert resp.status_code == 200
        data = resp.json()
        assert data["within_geofence"] == True
        assert data["distance_km"] < 1.0
        print(f"HQ check-location: distance={data['distance_km']} km, within={data['within_geofence']}")

    def test_check_location_remote_bypass_on(self, admin_session):
        """When bypass is ON, remote coords should return within_geofence: true"""
        # First ensure bypass is ON
        settings_resp = admin_session.get(f"{BASE_URL}/api/admin/office-settings")
        settings = settings_resp.json()
        if not settings.get("geofence_bypass"):
            # Enable it
            admin_session.put(f"{BASE_URL}/api/admin/office-settings", json={
                "latitude": settings["latitude"], "longitude": settings["longitude"],
                "radius_km": settings["radius_km"],
                "office_name": settings.get("name", "HQ"),
                "address": settings.get("address", ""),
                "geofence_bypass": True
            })

        resp = admin_session.post(f"{BASE_URL}/api/attendance/check-location",
                                  json={"latitude": REMOTE_LAT, "longitude": REMOTE_LNG})
        assert resp.status_code == 200
        data = resp.json()
        assert data["within_geofence"] == True, f"Expected within_geofence=True with bypass ON, got {data}"
        assert data["geofence_bypass"] == True
        print(f"Remote with bypass ON: within={data['within_geofence']}, distance={data['distance_km']} km")

    def test_check_location_remote_bypass_off(self, admin_session, original_settings):
        """When bypass is OFF, remote coords should return within_geofence: false"""
        # Disable bypass
        resp = admin_session.put(f"{BASE_URL}/api/admin/office-settings", json={
            "latitude": original_settings["latitude"],
            "longitude": original_settings["longitude"],
            "radius_km": original_settings["radius_km"],
            "office_name": original_settings.get("name", "HQ"),
            "address": original_settings.get("address", ""),
            "geofence_bypass": False
        })
        assert resp.status_code == 200

        resp = admin_session.post(f"{BASE_URL}/api/attendance/check-location",
                                  json={"latitude": REMOTE_LAT, "longitude": REMOTE_LNG})
        assert resp.status_code == 200
        data = resp.json()
        assert data["within_geofence"] == False, f"Expected within_geofence=False with bypass OFF, got {data}"
        print(f"Remote with bypass OFF: within={data['within_geofence']}, distance={data['distance_km']} km")

    def test_disable_geofence_bypass_persists(self, admin_session):
        resp = admin_session.get(f"{BASE_URL}/api/admin/office-settings")
        data = resp.json()
        assert data["geofence_bypass"] == False
        print("Geofence bypass disabled and persisted correctly")
