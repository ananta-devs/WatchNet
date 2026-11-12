package config

import (
	"os"
	"testing"
)

func TestLoadConfigDefaults(t *testing.T) {
	cfg := LoadConfig()
	if cfg.BackendURL == "" {
		t.Errorf("Expected BackendURL to be populated")
	}
	if cfg.ScanIntervalSec <= 0 {
		t.Errorf("Expected ScanIntervalSec > 0, got %d", cfg.ScanIntervalSec)
	}
}

func TestGetEnv(t *testing.T) {
	os.Setenv("TEST_KEY_WATCHNET", "custom_val")
	defer os.Unsetenv("TEST_KEY_WATCHNET")

	val := getEnv("TEST_KEY_WATCHNET", "default")
	if val != "custom_val" {
		t.Errorf("Expected custom_val, got %s", val)
	}

	valDefault := getEnv("NON_EXISTENT_KEY", "default")
	if valDefault != "default" {
		t.Errorf("Expected default, got %s", valDefault)
	}
}
