# WatchNet Project Overview

**Document Version:** 1.0.0  
**Status:** Approved Architecture Baseline  
**Classification:** Technical Architecture & Scope  

---

## 1. Executive Summary

WatchNet is an enterprise-grade, privacy-first, modern network intelligence, monitoring, and family safety platform designed to completely replace NetAlertX with 100% feature parity.

NetAlertX established a vibrant open-source standard for self-hosted home network monitoring, device discovery, and alert automation. However, its historical technical architecture (mixing PHP 8 with asynchronous Python scripts, utilizing unindexed flat SQLite databases with frequent lock contention, and exposing arbitrary client-side SQL execution endpoints) creates severe operational and security roadblocks in modern infrastructure.

WatchNet undertakes a clean-room architectural overhaul:
1. **Zero PHP & Zero Monolithic Shell Loops**: The web runtime is completely rebuilt in Next.js 15 (React 19, TypeScript) and modern Tailwind CSS v4 with shadcn/ui.
2. **Asynchronous Backend Services**: Powered by FastAPI (Python 3.12+), SQLAlchemy 2.0 (async), and Pydantic v2, backed by PostgreSQL 16+ with partitioned time-series event tables.
3. **High-Performance Network Collector**: Low-level packet capture, ARP/NDP discovery, and ICMP monitoring isolated into a dedicated Go daemon executing under Linux capabilities (CAP_NET_RAW).
4. **Hardware-Agnostic Router Adapters**: Unified BaseRouterAdapter supporting OpenWrt, AsusWRT, FRITZ!Box, MikroTik, UniFi, and Kea DHCP without hardcoding vendor logic.
5. **Decoupled Parental Controls & DNS Policy Orchestration**: Dynamic DNS filtering via AdGuard Home and Pi-hole policy engines decoupled from core network discovery to ensure resilience.

---

## 2. Core Value Propositions

- **Comprehensive Network Discovery**: Active layer-2 ARP/NDP probing, layer-3 ICMP ping sweeps, passive packet sniffing, DHCP lease snooping, and router API queries provide continuous visibility over every device on the local network.
- **Device Intelligence & Lifecycle Tracking**: Maintains rich historical timelines of IP address transitions, MAC randomization events, hourly/daily presence bitmaps, and connected duration intervals.
- **Enterprise-Grade Alerting & Automation**: Event-driven webhook and multi-channel notification engine (supporting Telegram, Discord, Pushbullet, Pushover, NTFY, Email, MQTT) coupled with a flexible workflow pipeline.
- **Privacy & Transparent Family Safety**: Per-device DNS policies, category filtering, and scheduled bedtime lockouts configured transparently, with explicit technical boundaries acknowledged regarding DoH and encrypted VPNs.
- **Multi-Site Architecture**: Centralized hub managing distributed remote Go collectors across branch offices or segmented home VLANs over mutual TLS (mTLS).
