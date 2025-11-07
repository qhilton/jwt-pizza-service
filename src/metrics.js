const os = require('os');
const config = require('./config');

// =========================
// In-memory metric counters
// =========================

// System / Request metrics
const requestsByEndpoint = {};
const requestsByMethod = {};
let totalRequests = 0;

// Authentication metrics
let authAttemptsSuccess = 0;
let authAttemptsFailed = 0;

// Pizza metrics
let pizzasSold = 0;
let pizzaCreationFailures = 0;
let pizzaRevenue = 0;

// Active users (can be set from your session manager or auth layer)
let activeUsers = 0;
const activeUsersMap = new Map();

// Latency metrics (average or cumulative per interval)
// let latencyService = 0;
// let latencyPizzaCreation = 0;

let serviceLatencies = [];
let pizzaLatencies = [];

// =========================
// Middleware & metric hooks
// =========================

// Middleware to track incoming HTTP requests
function requestTracker(req, res, next) {
    const startTime = Date.now();
    const endpoint = `[${req.method}] ${req.path}`;
    requestsByEndpoint[endpoint] = (requestsByEndpoint[endpoint] || 0) + 1;
    requestsByMethod[req.method] = (requestsByMethod[req.method] || 0) + 1;
    totalRequests++;

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        trackServiceLatency(duration);
    });

    next();
}

// Example hook for latency tracking
// function trackServiceLatency(ms) {
//     latencyService += ms;
// }
// function trackPizzaLatency(ms) {
//     latencyPizzaCreation += ms;
// }

function trackServiceLatency(ms) {
    serviceLatencies.push(ms);
    if (serviceLatencies.length > 100) serviceLatencies.shift(); // avoid memory growth
}

function trackPizzaLatency(ms) {
    pizzaLatencies.push(ms);
    if (pizzaLatencies.length > 100) pizzaLatencies.shift();
}

// Calculate average latency when reporting
function getAverageLatency(latencies) {
    if (latencies.length === 0) return 0;
    const sum = latencies.reduce((a, b) => a + b, 0);
    return Math.round(sum / latencies.length);
}

// Authentication metric helpers
function trackAuthAttempt(success) {
    if (success) authAttemptsSuccess++;
    else authAttemptsFailed++;
}

// Pizza metric helpers
function trackPizzaSold(price) {
    pizzasSold++;
    pizzaRevenue += price;
}
function trackPizzaFailure() {
    pizzaCreationFailures++;
}

// Active users (could be set externally)
function setActiveUsers(count) {
    activeUsers = count;
}

// =========================
// Authentication + Active User helpers
// =========================

// Track authentication attempts and adjust active user count
function recordAuthAttempt(success, userId) {
    if (success) {
        authAttemptsSuccess++;

        // When user successfully authenticates, update their activity timestamp
        if (userId != null) {
            activeUsersMap.set(userId, Date.now());
        }

        activeUsers = activeUsersMap.size;
    } else {
        authAttemptsFailed++;
    }
}

// Decrease active user count when logging out
function removeActiveUser(userId) {
    if (userId != null) {
        activeUsersMap.delete(userId);
        activeUsers = activeUsersMap.size;
    }
}

// =========================
// System metrics helpers
// =========================

// function getCpuUsagePercentage() {
//   const cpuUsage = os.loadavg()[0] / os.cpus().length;
//   console.log("cpu usage ", cpuUsage);
//   console.log("os.loadavg() ", os.loadavg());
//   return cpuUsage.toFixed(2) * 100;
// }

function getCpuUsagePercentage() {
    const load = os.loadavg()[0];
    const cpus = os.cpus().length;

    if (load === 0) {
        // Fallback for Windows or unavailable loadavg
        return (process.cpuUsage().user / 1e6).toFixed(2);
    }

    return ((load / cpus) * 100).toFixed(2);
}

function getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const usedMemory = totalMemory - os.freemem();
    return ((usedMemory / totalMemory) * 100).toFixed(2);
}

// =========================
// Pizza purchase helper
// =========================
function pizzaPurchase(success, latencyMs, price) {
    if (success) {
        trackPizzaSold(price);
    } else {
        trackPizzaFailure();
    }
    trackPizzaLatency(latencyMs);
}

// =========================
// Periodic metric push loop
// =========================

setInterval(() => {
    const metrics = [];

    // Clean up inactive users (no activity in last 5 minutes)
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    for (const [userId, lastActivityTime] of activeUsersMap) {
        if (lastActivityTime < fiveMinutesAgo) {
            activeUsersMap.delete(userId);
            // console.log(`User ${userId} expired from active users (last activity: ${new Date(lastActivityTime).toISOString()})`);
        }
    }

    // --- HTTP Request Metrics ---
    Object.keys(requestsByMethod).forEach((method) => {
        metrics.push(createMetric('http_requests_by_method', requestsByMethod[method], '1', 'sum', 'asInt', { method }));
    });
    Object.keys(requestsByEndpoint).forEach((endpoint) => {
        metrics.push(createMetric('http_requests_by_endpoint', requestsByEndpoint[endpoint], '1', 'sum', 'asInt', { endpoint }));
    });
    metrics.push(createMetric('http_total_requests', totalRequests, '1', 'sum', 'asInt', {}));


    // --- System Metrics ---
    metrics.push(createMetric('cpu_usage', parseFloat(getCpuUsagePercentage()), '%', 'gauge', 'asDouble', {}));
    metrics.push(createMetric('memory_usage', parseFloat(getMemoryUsagePercentage()), '%', 'gauge', 'asDouble', {}));

    // --- Authentication Metrics ---
    metrics.push(createMetric('auth_attempts_success', authAttemptsSuccess, '1', 'sum', 'asInt', {}));
    metrics.push(createMetric('auth_attempts_failed', authAttemptsFailed, '1', 'sum', 'asInt', {}));

    // --- Active Users ---
    metrics.push(createMetric('active_users', activeUsers, '1', 'gauge', 'asInt', {}));

    // --- Pizza Metrics ---
    metrics.push(createMetric('pizza_sold', pizzasSold, '1', 'sum', 'asInt', {}));
    metrics.push(createMetric('pizza_creation_failures', pizzaCreationFailures, '1', 'sum', 'asInt', {}));
    metrics.push(createMetric('pizza_revenue', pizzaRevenue, 'usd', 'sum', 'asDouble', {}));

    // --- Latency Metrics ---
    // metrics.push(createMetric('latency_service', latencyService, 'ms', 'sum', 'asInt', {}));
    // metrics.push(createMetric('latency_pizza_creation', latencyPizzaCreation, 'ms', 'sum', 'asInt', {}));

    // --- Latency Metrics (averages over last minute) ---
    // console.log("serviceLat", serviceLatencies);
    // console.log("avg serviceLat", getAverageLatency(serviceLatencies));
    // console.log("pizzaLatencies", pizzaLatencies);
    // console.log("avg pizzaLatencies", getAverageLatency(pizzaLatencies));
    metrics.push(createMetric('latency_service', getAverageLatency(serviceLatencies), 'ms', 'gauge', 'asInt', {}));
    metrics.push(createMetric('latency_pizza_creation', getAverageLatency(pizzaLatencies), 'ms', 'gauge', 'asInt', {}));

    // Send to Grafana
    sendMetricToGrafana(metrics);

    // Reset counters for per-minute metrics
    resetCounters();
}, 60000); // every 1 minute

// =========================
// Metric creation / sending
// =========================

function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes) {
    attributes = { ...attributes, source: config.source };

    const metric = {
        name: metricName,
        unit: metricUnit,
        [metricType]: {
            dataPoints: [
                {
                    [valueType]: metricValue,
                    timeUnixNano: Date.now() * 1_000_000,
                    attributes: Object.entries(attributes).map(([key, value]) => ({
                        key,
                        value: { stringValue: String(value) },
                    })),
                },
            ],
        },
    };

    if (metricType === 'sum') {
        metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
        metric[metricType].isMonotonic = true;
    }

    return metric;
}

function sendMetricToGrafana(metrics) {
    const body = {
        resourceMetrics: [
            {
                scopeMetrics: [{ metrics }],
            },
        ],
    };

    fetch(`${config.url}`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
        },
    })
        .then((response) => {
            if (!response.ok) {
                response.text().then((text) => {
                    console.error(`Failed to push metrics data to Grafana: ${text}`);
                });
            } else {
                // console.log(`✅ Metrics pushed successfully`);
            }
        })
        .catch((error) => console.error('Error pushing metrics:', error));
}

// =========================
// Reset counters (per minute)
// =========================
function resetCounters() {
    for (const key in requestsByEndpoint) delete requestsByEndpoint[key];
    for (const key in requestsByMethod) delete requestsByMethod[key];
    totalRequests = 0;

    authAttemptsSuccess = 0;
    authAttemptsFailed = 0;

    pizzasSold = 0;
    pizzaCreationFailures = 0;
    pizzaRevenue = 0;

    // latencyService = 0;
    // latencyPizzaCreation = 0;

    // serviceLatencies.length = 0;
    // pizzaLatencies.length = 0;

    // Preserve last 50 latency samples for averaging
    if (serviceLatencies.length > 50) {
        serviceLatencies = serviceLatencies.slice(-50);
    } else {
        serviceLatencies = [];
    }

    if (pizzaLatencies.length > 50) {
        pizzaLatencies = pizzaLatencies.slice(-50);
    } else {
        pizzaLatencies = [];
    }
}

// =========================
// Exports
// =========================
module.exports = {
    requestTracker,
    trackAuthAttempt,
    trackPizzaSold,
    trackPizzaFailure,
    setActiveUsers,
    recordAuthAttempt,
    removeActiveUser,
    trackServiceLatency,
    trackPizzaLatency,
    pizzaPurchase,
};
