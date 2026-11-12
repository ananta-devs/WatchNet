package config

import (
	"flag"
	"os"
	"strconv"
)

type Config struct {
	Interface       string
	BackendURL      string
	RedisAddr       string
	ScanIntervalSec int
	LogLevel        string
}

func LoadConfig() *Config {
	cfg := &Config{}

	flag.StringVar(&cfg.Interface, "interface", getEnv("COLLECTOR_INTERFACE", "eth0"), "Network interface to monitor")
	flag.StringVar(&cfg.BackendURL, "backend-url", getEnv("BACKEND_URL", "http://backend:8000"), "WatchNet backend API URL")
	flag.StringVar(&cfg.RedisAddr, "redis-addr", getEnv("REDIS_URL", "redis:6379"), "Redis endpoint address")
	flag.IntVar(&cfg.ScanIntervalSec, "scan-interval", getEnvAsInt("SCAN_INTERVAL_SEC", 30), "Network scan interval in seconds")
	flag.StringVar(&cfg.LogLevel, "log-level", getEnv("LOG_LEVEL", "INFO"), "Log output level (DEBUG, INFO, WARN, ERROR)")

	flag.Parse()
	return cfg
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return defaultVal
}

func getEnvAsInt(key string, defaultVal int) int {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return defaultVal
}
