// MQTT已经通过<script>标签全局加载

// MQTT 配置
const mqttConfig = {
    host: 's1202e81.ala.cn-hangzhou.emqxsl.cn',
    port: 8084,  // 修改为WebSocket SSL端口
    username: 'emqx',
    password: 'linjiajun1',
    clientId: 'webClient_' + Math.random().toString(16).substr(2, 8),
    protocol: 'wss',
    path: '/mqtt'  // 添加WebSocket路径
};

const topics = {
    status: 'liuxing23i/fan',
    control: 'liuxing23i/fan/control'
};

let client = null;
let reconnectTimeout = null;

// 连接MQTT
function connectMQTT() {
    updateMqttStatus('connecting');
    
    const options = {
        clientId: mqttConfig.clientId,
        username: mqttConfig.username,
        password: mqttConfig.password,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30 * 1000,
        rejectUnauthorized: false,
        path: mqttConfig.path
    };

    try {
        console.log('正在连接MQTT服务器...');
        console.log('连接配置:', {
            url: `${mqttConfig.protocol}://${mqttConfig.host}:${mqttConfig.port}${mqttConfig.path}`,
            ...options
        });

        // 创建完整的WebSocket URL
        const wsUrl = `${mqttConfig.protocol}://${mqttConfig.host}:${mqttConfig.port}${mqttConfig.path}`;
        client = mqtt.connect(wsUrl, options);

        client.on('connect', () => {
            console.log('MQTT连接成功');
            updateMqttStatus('connected');
            
            client.subscribe(topics.status, (err) => {
                if (!err) {
                    console.log('已订阅状态主题');
                }
            });
        });

        client.on('reconnect', () => {
            console.log('正在尝试重新连接...');
            updateMqttStatus('connecting');
        });

        client.on('message', (topic, message) => {
            try {
                const data = JSON.parse(message.toString());
                
                if (data.type === 'predict_busy') {
                    // 显示忙碌状态提示
                    alert(data.message);
                    // 如果是实时预测模式，切换回"关闭预测"
                    if (document.querySelector('input[value="realtime"]').checked) {
                        document.querySelector('input[value="none"]').checked = true;
                    }
                } else if (data.type === 'prediction_result') {
                    const predictionResult = document.getElementById('predictionResult');
                    predictionResult.style.display = 'block';
                    
                    // 更新预测信息
                    document.getElementById('predictedSpeed').textContent = `${data.speed} 档`;
                    document.getElementById('predictedDuration').textContent = 
                        data.duration ? `${data.duration} 分钟` : '--';  // 确保显示运行时间
                    document.getElementById('predictedRecommendation').textContent = 
                        data.recommendation || '--';  // 确保显示建议
                    
                    // 根据置信度调整UI
                    if (data.low_confidence) {
                        predictionResult.classList.add('low-confidence');
                        document.getElementById('applyPrediction').disabled = true;
                    } else {
                        predictionResult.classList.remove('low-confidence');
                        document.getElementById('applyPrediction').disabled = false;
                    }
                    
                    // 显示输入参数（调试用）
                    console.log('预测输入参数:', data.input);
                } else {
                    updateSensorValues(data);
                    updateControlStatus(data);
                }

                // 处理预测模式改变的确认消息
                if (data.type === 'predict_mode_changed') {
                    // 更新radio button的选中状态
                    document.querySelectorAll('input[name="predictMode"]').forEach(radio => {
                        if (radio.value === data.mode) {
                            radio.checked = true;
                        }
                    });
                    
                    // 更新表单显示状态
                    const manualForm = document.getElementById('manualInputForm');
                    manualForm.style.display = data.mode === 'manual' ? 'block' : 'none';
                }
            } catch (e) {
                console.error('解析消息失败:', e);
            }
        });

        client.on('error', (error) => {
            console.error('MQTT错误:', error);
            updateMqttStatus('disconnected');
        });

        client.on('close', () => {
            console.log('MQTT连接已关闭');
            updateMqttStatus('disconnected');
        });

        client.on('offline', () => {
            console.log('MQTT客户端离线');
            updateMqttStatus('disconnected');
        });

    } catch (error) {
        console.error('MQTT连接失败:', error);
        updateMqttStatus('disconnected');
    }
}

// 更新MQTT状态显示
function updateMqttStatus(status) {
    const statusElement = document.getElementById('mqttStatus');
    statusElement.className = 'mqtt-status mqtt-' + status;
    
    switch(status) {
        case 'connected':
            statusElement.textContent = '已连接';
            break;
        case 'disconnected':
            statusElement.textContent = '未连接';
            break;
        case 'connecting':
            statusElement.textContent = '连接中...';
            break;
    }
}

// 更新传感器数值显示
function updateSensorValues(data) {
    if (data.temperature !== undefined) {
        document.getElementById('temperature').textContent = data.temperature.toFixed(1) + '°C';
    }
    if (data.humidity !== undefined) {
        document.getElementById('humidity').textContent = data.humidity.toFixed(1) + '%';
    }
    if (data.light !== undefined) {
        document.getElementById('light').textContent = data.light.toFixed(0) + ' lx';
    }

    // 如果在分析页面，也更新图表
    if (window.updateChart) {
        updateChart(data);
    }
}

// 更新系统状态显示
function updateSystemStatus(data) {
    if (data.cpu_temp !== undefined) {
        document.getElementById('cpuTemp').textContent = data.cpu_temp.toFixed(1) + '°C';
    }
    if (data.cpu_freq !== undefined) {
        document.getElementById('cpuFreq').textContent = data.cpu_freq + 'MHz';
    }
    if (data.memory_usage !== undefined) {
        document.getElementById('memoryUsage').textContent = data.memory_usage.toFixed(1) + '%';
    }
    if (data.uptime !== undefined) {
        document.getElementById('uptime').textContent = formatUptime(data.uptime);
    }

    // 如果在分析页面，更新设备信息
    if (window.updateDeviceInfo) {
        updateDeviceInfo(data);
    }

    // 添加系统日志
    if (window.addLogEntry) {
        addLogEntry(`系统状态更新 - CPU: ${data.cpu_temp}°C, 内存: ${data.memory_usage}%`);
    }
}

// 格式化运行时间
function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// 更新控制状态
function updateControlStatus(data) {
    if (data.fan_switch !== undefined) {
        document.getElementById('fanSwitch').checked = data.fan_switch;
    }
    if (data.fan_speed !== undefined) {
        document.getElementById('fanSpeed').value = data.fan_speed;
        document.getElementById('fanSpeedValue').textContent = data.fan_speed;
    }
    if (data.fan_direction !== undefined) {
        const directionElement = document.getElementById('fanDirection');
        if (directionElement) {
            directionElement.textContent = data.fan_direction === 'forward' ? '正转' : '反转';
            directionElement.className = 'badge ' + 
                (data.fan_direction === 'forward' ? 'bg-info' : 'bg-warning');
        }
    }
    if (data.led !== undefined) {
        document.getElementById('ledSwitch').checked = data.led;
    }

    // 更新预测状态显示
    if (data.predict_mode !== undefined) {
        document.querySelectorAll('input[name="predictMode"]').forEach(radio => {
            radio.checked = radio.value === data.predict_mode;
        });
        
        document.getElementById('manualInputForm').style.display = 
            data.predict_mode === 'manual' ? 'block' : 'none';
    }

    // 处理预测结果
    if (data.type === 'predict_result') {
        const speedDesc = {
            0: "关闭 (0%)",
            1: "低速 (33%)",
            2: "中速 (66%)",
            3: "高速 (100%)"
        };
        
        document.getElementById('predictedSpeed').textContent = 
            `${data.fan_speed}档 - ${speedDesc[data.fan_speed]}`;
        document.getElementById('predictedDuration').textContent = data.duration;
        document.getElementById('predictedRecommendation').textContent = data.recommendation;
        
        document.getElementById('predictionResult').style.display = 'block';
    }
}

// 发送控制命令
function sendControl(type, value) {
    if (client && client.connected) {
        const command = {
            type: type,
            value: value
        };
        
        // 如果是速度控制，保持当前方向
        if (type === 'fan_speed') {
            const directionElement = document.getElementById('fanDirection');
            if (directionElement) {
                command.direction = directionElement.textContent === '正转' ? 'forward' : 'reverse';
            }
        }
        
        client.publish(topics.control, JSON.stringify(command));
        console.log('发送控制命令:', command);
    } else {
        console.error('MQTT未连接，无法发送命令');
    }
}

// 初始化控件事件监听
function initializeControls() {
    try {
        // 风扇开关
        document.getElementById('fanSwitch').addEventListener('change', (e) => {
            sendControl('fan_switch', e.target.checked);
        });

        // 风扇速度
        document.getElementById('fanSpeed').addEventListener('change', (e) => {
            const speed = parseInt(e.target.value);
            document.getElementById('fanSpeedValue').textContent = speed;
            sendControl('fan_speed', speed);
        });

        // LED开关
        document.getElementById('ledSwitch').addEventListener('change', (e) => {
            sendControl('led', e.target.checked);
        });

        // 预测模式切换
        document.querySelectorAll('input[name="predictMode"]').forEach(radio => {
            let lastSwitchTime = 0;
            const MIN_SWITCH_INTERVAL = 2000; // 最小切换间隔2秒
            
            radio.addEventListener('change', (e) => {
                const now = Date.now();
                if (now - lastSwitchTime < MIN_SWITCH_INTERVAL) {
                    // 如果切换太频繁，恢复到之前的选择
                    e.preventDefault();
                    radio.checked = !radio.checked;
                    alert('切换太频繁，请稍后再试');
                    return;
                }
                lastSwitchTime = now;
                
                const manualForm = document.getElementById('manualInputForm');
                const predictionResult = document.getElementById('predictionResult');
                const mode = e.target.value;
                
                // 隐藏预测结果
                predictionResult.style.display = 'none';
                
                // 显示/隐藏手动输入表单
                manualForm.style.display = mode === 'manual' ? 'block' : 'none';
                
                // 发送预测模式切换命令
                const command = {
                    type: 'predict_mode',
                    value: mode
                };
                
                if (client?.connected) {
                    client.publish(topics.control, JSON.stringify(command));
                    console.log('发送预测模式切换命令:', command);
                }
            });
        });

        // 手动预测按钮
        document.getElementById('predictBtn')?.addEventListener('click', (e) => {
            e.preventDefault(); // 防止表单提交导致页面刷新
            
            const temp = parseFloat(document.getElementById('manualTemp').value);
            const humidity = parseFloat(document.getElementById('manualHumidity').value);
            const light = parseFloat(document.getElementById('manualLight').value);
            const hour = parseInt(document.getElementById('manualHour').value);

            if (client?.connected) {
                const command = {
                    type: 'predict_mode',
                    value: 'manual',
                    temp: temp,
                    humidity: humidity,
                    light: light,
                    hour: hour
                };
                client.publish(topics.control, JSON.stringify(command));
                console.log('发送预测命令:', command);
            }
        });

        // 应用预测结果按钮
        document.getElementById('applyPrediction')?.addEventListener('click', () => {
            const speedText = document.getElementById('predictedSpeed').textContent;
            const speed = parseInt(speedText.match(/\d+/)[0]);
            
            // 发送开关命令
            sendControl('fan_switch', speed > 0);
            
            // 如果需要开启风扇，设置速度
            if (speed > 0) {
                const speedMap = { 1: 33, 2: 66, 3: 100 };
                sendControl('fan_speed', speedMap[speed]);
            }
            
            // 隐藏预测结果
            document.getElementById('predictionResult').style.display = 'none';
        });

        // 取消预测按钮
        document.getElementById('cancelPrediction')?.addEventListener('click', () => {
            document.getElementById('predictionResult').style.display = 'none';
        });
    } catch (error) {
        console.error('初始化控件时出错:', error);
    }
}

// 在页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeControls();
    connectMQTT();
});

// 导出到全局作用域
window.app = {
    mqttConfig,
    connectMQTT
}; 