// MQTT配置
const mqttConfig = {
    host: 's1202e81.ala.cn-hangzhou.emqxsl.cn',
    port: 8084,
    clientId: 'web_analysis_' + Math.random().toString(16).substring(2, 8),
    username: 'emqx',
    password: 'linjiajun1',
    protocol: 'wss'
};

let mqttClient = null;
let historyChart = null;
let historicalData = {
    temperature: [],
    humidity: [],
    cpuTemp: []
};

// 初始化图表
function initChart() {
    const ctx = document.getElementById('historyChart').getContext('2d');
    historyChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: '温度',
                data: [],
                borderColor: '#2196F3',
                tension: 0.4,
                fill: false
            }, {
                label: '湿度',
                data: [],
                borderColor: '#4CAF50',
                tension: 0.4,
                fill: false
            }, {
                label: 'CPU温度',
                data: [],
                borderColor: '#F44336',
                tension: 0.4,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        displayFormats: {
                            minute: 'HH:mm'
                        }
                    },
                    title: {
                        display: true,
                        text: '时间'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: '数值'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(1);
                                if (label.includes('温度')) {
                                    label += '°C';
                                } else if (label.includes('湿度')) {
                                    label += '%';
                                }
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

// 更新图表数据
function updateChart(range = '1h') {
    const now = Date.now();
    let startTime;
    
    switch(range) {
        case '6h':
            startTime = now - 6 * 60 * 60 * 1000;
            break;
        case '24h':
            startTime = now - 24 * 60 * 60 * 1000;
            break;
        default: // 1h
            startTime = now - 60 * 60 * 1000;
    }
    
    // 过滤数据
    const filteredData = {
        temperature: historicalData.temperature.filter(d => d.x >= startTime),
        humidity: historicalData.humidity.filter(d => d.x >= startTime),
        cpuTemp: historicalData.cpuTemp.filter(d => d.x >= startTime)
    };
    
    // 更新图表
    historyChart.data.datasets[0].data = filteredData.temperature;
    historyChart.data.datasets[1].data = filteredData.humidity;
    historyChart.data.datasets[2].data = filteredData.cpuTemp;
    historyChart.update();
}

// 添加预测历史记录
function addPredictionHistory(prediction) {
    const tbody = document.getElementById('predictionHistory');
    const row = document.createElement('tr');
    
    const time = new Date(prediction.timestamp);
    const timeStr = time.toLocaleTimeString();
    const error = Math.abs(prediction.predicted - prediction.actual).toFixed(1);
    
    row.innerHTML = `
        <td>${timeStr}</td>
        <td>${prediction.predicted.toFixed(1)}°C</td>
        <td>${prediction.actual.toFixed(1)}°C</td>
        <td>${error}°C</td>
    `;
    
    // 保持最新的10条记录
    while (tbody.children.length >= 10) {
        tbody.removeChild(tbody.firstChild);
    }
    
    tbody.appendChild(row);
}

// 添加系统日志
function addSystemLog(message, type = 'info') {
    const logContainer = document.getElementById('systemLog');
    const logEntry = document.createElement('div');
    const time = new Date().toLocaleTimeString();
    
    logEntry.className = `log-entry log-${type}`;
    logEntry.textContent = `[${time}] ${message}`;
    
    logContainer.appendChild(logEntry);
    
    // 自动滚动
    if (document.getElementById('autoScroll').checked) {
        logContainer.scrollTop = logContainer.scrollHeight;
    }
    
    // 保持最新的100条日志
    while (logContainer.children.length > 100) {
        logContainer.removeChild(logContainer.firstChild);
    }
}

// 更新设备信息
function updateDeviceInfo(info) {
    if (info.deviceId) document.getElementById('deviceId').textContent = info.deviceId;
    if (info.firmwareVersion) document.getElementById('firmwareVersion').textContent = info.firmwareVersion;
    if (info.macAddress) document.getElementById('macAddress').textContent = info.macAddress;
    if (info.wifiSignal) document.getElementById('wifiSignal').textContent = info.wifiSignal + ' dBm';
    if (info.ipAddress) document.getElementById('ipAddress').textContent = info.ipAddress;
    if (info.lastUpdate) document.getElementById('lastUpdate').textContent = new Date(info.lastUpdate).toLocaleString();
}

// 更新预测准确率
function updatePredictionAccuracy(accuracy) {
    document.getElementById('predictionAccuracy').textContent = accuracy.toFixed(1) + '%';
    document.getElementById('lastPrediction').textContent = new Date().toLocaleTimeString();
}

// 处理MQTT消息
function handleMQTTMessage(topic, message) {
    try {
        const data = JSON.parse(message.toString());
        console.log('收到MQTT消息:', topic, data);
        
        const timestamp = Date.now();
        
        // 更新历史数据
        if (data.temperature !== undefined) {
            historicalData.temperature.push({x: timestamp, y: data.temperature});
        }
        if (data.humidity !== undefined) {
            historicalData.humidity.push({x: timestamp, y: data.humidity});
        }
        if (data.cpu_temp !== undefined) {
            historicalData.cpuTemp.push({x: timestamp, y: data.cpu_temp});
        }
        
        // 限制数据点数量
        const maxDataPoints = 1000;
        if (historicalData.temperature.length > maxDataPoints) {
            historicalData.temperature = historicalData.temperature.slice(-maxDataPoints);
            historicalData.humidity = historicalData.humidity.slice(-maxDataPoints);
            historicalData.cpuTemp = historicalData.cpuTemp.slice(-maxDataPoints);
        }
        
        // 更新图表
        updateChart();
        
        // 处理预测结果
        if (data.prediction) {
            addPredictionHistory(data.prediction);
            if (data.prediction.accuracy) {
                updatePredictionAccuracy(data.prediction.accuracy);
            }
        }
        
        // 处理设备信息
        if (data.device_info) {
            updateDeviceInfo(data.device_info);
        }
        
        // 处理系统日志
        if (data.log) {
            addSystemLog(data.log.message, data.log.type);
        }
        
    } catch (error) {
        console.error('处理MQTT消息失败:', error);
        addSystemLog('处理消息失败: ' + error.message, 'error');
    }
}

// 更新MQTT状态显示
function updateMQTTStatus(status, message = '') {
    const statusElement = document.getElementById('mqttStatus');
    statusElement.className = 'mqtt-status';
    
    switch(status) {
        case 'connected':
            statusElement.classList.add('mqtt-connected');
            statusElement.textContent = '已连接';
            break;
        case 'connecting':
            statusElement.classList.add('mqtt-connecting');
            statusElement.textContent = '连接中...';
            break;
        case 'disconnected':
            statusElement.classList.add('mqtt-disconnected');
            statusElement.textContent = message || '未连接';
            break;
    }
}

// 连接MQTT服务器
async function connectMQTT() {
    try {
        console.log('开始连接MQTT服务器...');
        updateMQTTStatus('connecting');
        addSystemLog('正在连接MQTT服务器...');

        const wsUrl = `${mqttConfig.protocol}://${mqttConfig.host}:${mqttConfig.port}/mqtt`;
        
        const options = {
            clientId: mqttConfig.clientId,
            username: mqttConfig.username,
            password: mqttConfig.password,
            clean: true,
            rejectUnauthorized: false,
            reconnectPeriod: 5000,
        };

        mqttClient = mqtt.connect(wsUrl, options);

        mqttClient.on('connect', () => {
            console.log('MQTT连接成功');
            updateMQTTStatus('connected');
            addSystemLog('MQTT连接成功', 'info');
            subscribeToTopics();
        });

        mqttClient.on('error', (error) => {
            console.error('MQTT错误:', error);
            updateMQTTStatus('disconnected', 'MQTT错误');
            addSystemLog('MQTT错误: ' + error.message, 'error');
        });

        mqttClient.on('message', handleMQTTMessage);

        mqttClient.on('close', () => {
            console.log('MQTT连接已断开');
            updateMQTTStatus('disconnected');
            addSystemLog('MQTT连接已断开', 'warning');
        });

        mqttClient.on('reconnect', () => {
            console.log('MQTT重新连接中...');
            updateMQTTStatus('connecting');
            addSystemLog('MQTT重新连接中...', 'warning');
        });

    } catch (error) {
        console.error('MQTT连接失败:', error);
        updateMQTTStatus('disconnected', 'MQTT连接失败');
        addSystemLog('MQTT连接失败: ' + error.message, 'error');
    }
}

// 订阅主题
function subscribeToTopics() {
    const topics = [
        'liuxing23i/fan/data',      // 传感器数据
        'liuxing23i/fan/system',    // 系统状态
        'liuxing23i/fan/predict'    // 预测结果
    ];

    topics.forEach(topic => {
        mqttClient.subscribe(topic, (err) => {
            if (err) {
                console.error('订阅主题失败:', topic, err);
                addSystemLog(`订阅失败: ${topic}`, 'error');
            } else {
                console.log('成功订阅主题:', topic);
                addSystemLog(`成功订阅: ${topic}`, 'info');
            }
        });
    });
}

// 绑定图表时间范围按钮事件
document.querySelectorAll('[data-range]').forEach(button => {
    button.addEventListener('click', (e) => {
        const range = e.target.dataset.range;
        updateChart(range);
        
        // 更新按钮状态
        document.querySelectorAll('[data-range]').forEach(btn => {
            btn.classList.remove('active');
        });
        e.target.classList.add('active');
    });
});

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('初始化分析页面...');
    initChart();
    connectMQTT();
}); 