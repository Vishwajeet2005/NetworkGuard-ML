# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
A real Security Operations Center (SOC) analyst monitoring live enterprise traffic.

## Product Purpose
NetworkGuard ML is an intrusion detection platform designed to classify and visualize network traffic in real-time, providing immediate threat awareness and anomaly detection for enterprise environments.

## Positioning
Provides a fully integrated, full-stack ML pipeline that leverages continuous simulated traffic ingestion to demonstrate real-time predictive analytics.

## Operating Context
Used in high-stress, fast-paced SOC environments where analysts need immediate visual cues for emerging threats, requiring scanability and low cognitive overhead.

## Capabilities and Constraints
- Must preserve the live Python capture simulator.
- Must preserve Postgres database integration.
- Must use actual ML predictions derived from the NSL-KDD dataset.

## Evidence on Hand
- NSL-KDD dataset being replayed by the capture service.
- Live PostgreSQL stats aggregation API endpoints (`/dashboard/stats`, `/charts`, `/telemetry`).
