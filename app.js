// MQTT 配置
const mqttConfig = {
    host: 's1202e81.ala.cn-hangzhou.emqxsl.cn',
    port: 8084,
    clientId: 'web_' + Math.random().toString(16).substring(2, 8),
    username: 'emqx',
    password: 'linjiajun1',
    protocol: 'wss'
};

let mqttClient = null;

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 更新UI显示
function updateUI(params) {
    console.log('开始更新UI, 参数:', params);
    
    if (params.temperature !== undefined) {
        console.log('更新温度:', params.temperature);
        document.getElementById('temperature').textContent = params.temperature + '°C';
    }
    if (params.humidity !== undefined) {
        console.log('更新湿度:', params.humidity);
        document.getElementById('humidity').textContent = params.humidity + '%';
    }
    if (params.light !== undefined) {
        console.log('更新光照:', params.light);
        document.getElementById('light').textContent = params.light + ' lx';
    }
    if (params.led !== undefined) {
        console.log('更新LED状态:', params.led);
        document.getElementById('ledSwitch').checked = params.led;
    }
    if (params.fan_switch !== undefined) {
        console.log('更新风扇开关:', params.fan_switch);
        document.getElementById('fanSwitch').checked = params.fan_switch;
    }
    if (params.fan_speed !== undefined) {
        console.log('更新风扇速度:', params.fan_speed);
        const speedSlider = document.getElementById('fanSpeed');
        const speedValue = document.getElementById('fanSpeedValue');
        speedSlider.value = params.fan_speed;
        speedValue.textContent = params.fan_speed;
        console.log('设置后的风扇速度值:', speedSlider.value);
    }
    if (params.prediction_status !== undefined) {
        const predictBtn = document.getElementById('predictBtn');
        predictBtn.disabled = params.prediction_status === 'running' || params.prediction_status === 'cooldown';
        if (params.prediction_status === 'running') {
            predictBtn.textContent = '预测中...';
        } else if (params.prediction_status === 'cooldown') {
            predictBtn.textContent = `冷却中 (${params.cooldown_time}s)`;
        } else {
            predictBtn.textContent = '开始预测';
        }
    }
}

// 更新连接状态显示
function updateConnectionStatus(status, message = '') {
    const statusElement = document.getElementById('connectionStatus');
    const statusTextElement = document.getElementById('statusText');
    
    console.log('更新状态:', status, message);
    
    switch(status) {
        case 'online':
            statusElement.className = 'status-connected';
            statusTextElement.textContent = message || '在线';
            break;
        case 'error':
            statusElement.className = 'status-disconnected';
            statusTextElement.textContent = message || '错误';
            break;
        case 'loading':
            statusElement.className = 'status-loading';
            statusTextElement.textContent = message || '加载中...';
            break;
        default:
            statusElement.className = 'status-disconnected';
            statusTextElement.textContent = message || '离线';
    }
}

// 通过MQTT发送控制命令
function sendMQTTControl(type, value) {
    try {
        if (!mqttClient || !mqttClient.connected) {
            throw new Error('MQTT未连接');
        }

        console.log('发送MQTT控制命令:', type, value);
        const message = {
            type: type,
            value: value,
            timestamp: Date.now()
        };

        mqttClient.publish('liuxing23i/fan/control', JSON.stringify(message), { qos: 1 }, (error) => {
            if (error) {
                console.error('发送控制命令失败:', error);
                updateConnectionStatus('error', '发送失败');
            } else {
                console.log('控制命令发送成功');
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }
        });
    } catch (error) {
        console.error('发送控制命令失败:', error);
        updateConnectionStatus('error', error.message);
    }
}

// 绑定UI事件
document.getElementById('ledSwitch').addEventListener('change', function(e) {
    sendMQTTControl('led', e.target.checked);
});

document.getElementById('fanSwitch').addEventListener('change', function(e) {
    sendMQTTControl('fan_switch', e.target.checked);
});

document.getElementById('fanSpeed').addEventListener('input', function(e) {
    const value = parseInt(e.target.value);
    document.getElementById('fanSpeedValue').textContent = value;
});

document.getElementById('fanSpeed').addEventListener('change', function(e) {
    const value = parseInt(e.target.value);
    sendMQTTControl('fan_speed', value);
});

// 预测模式切换处理
document.querySelectorAll('input[name="predictMode"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const manualForm = document.getElementById('manualInputForm');
        manualForm.style.display = this.value === 'manual' ? 'block' : 'none';
    });
});

document.getElementById('predictBtn').addEventListener('click', function() {
    const mode = document.querySelector('input[name="predictMode"]:checked').value;
    let predictData = {};
    
    if (mode === 'manual') {
        // 获取手动输入的数据
        const temp = parseFloat(document.getElementById('manualTemp').value);
        const humidity = parseFloat(document.getElementById('manualHumidity').value);
        const light = parseFloat(document.getElementById('manualLight').value);
        const hour = parseInt(document.getElementById('manualHour').value);
        
        // 验证输入数据
        if (isNaN(temp) || isNaN(humidity) || isNaN(light) || isNaN(hour)) {
            alert('请输入有效的数值');
            return;
        }
        
        if (temp < 0 || temp > 40 || humidity < 0 || humidity > 100 || 
            light < 0 || light > 65535 || hour < 0 || hour > 23) {
            alert('请输入有效范围内的数值');
            return;
        }
        
        predictData = {
            type: 'predict',
            mode: 'manual',
            data: {
                temperature: temp,
                humidity: humidity,
                light: light,
                hour: hour
            }
        };
    } else {
        predictData = {
            type: 'predict',
            mode: 'real'
        };
    }
    
    sendMQTTControl(predictData.type, predictData);
    updateUI({ prediction_status: 'running' });
});

// 添加触摸反馈
document.querySelectorAll('.form-check-input, .form-select').forEach(element => {
    element.addEventListener('touchstart', function() {
        this.style.opacity = '0.7';
    });
    element.addEventListener('touchend', function() {
        this.style.opacity = '1';
    });
});

// 连接MQTT服务器
async function connectMQTT() {
    try {
        console.log('开始连接MQTT服务器...');
        updateConnectionStatus('loading', '正在连接MQTT服务器...');

        // 构建WebSocket URL
        const wsUrl = `${mqttConfig.protocol}://${mqttConfig.host}:${mqttConfig.port}/mqtt`;
        
        // 连接选项
        const options = {
            clientId: mqttConfig.clientId,
            username: mqttConfig.username,
            password: mqttConfig.password,
            clean: true,
            rejectUnauthorized: false,
            reconnectPeriod: 5000,
        };

        // 创建MQTT客户端连接
        mqttClient = mqtt.connect(wsUrl, options);

        // 监听连接事件
        mqttClient.on('connect', () => {
            console.log('MQTT连接成功');
            updateConnectionStatus('online', 'MQTT已连接');
            subscribeToTopics();
        });

        // 监听错误事件
        mqttClient.on('error', (error) => {
            console.error('MQTT错误:', error);
            updateConnectionStatus('error', 'MQTT连接错误');
        });

        // 监听消息事件
        mqttClient.on('message', (topic, message) => {
            console.log('收到MQTT消息:', topic, message.toString());
            handleMQTTMessage(topic, message);
        });

        // 监听断开连接事件
        mqttClient.on('close', () => {
            console.log('MQTT连接已断开');
            updateConnectionStatus('error', 'MQTT已断开');
        });

    } catch (error) {
        console.error('MQTT连接失败:', error);
        updateConnectionStatus('error', 'MQTT连接失败');
    }
}

// 订阅主题
function subscribeToTopics() {
    const topics = [
        'liuxing23i/fan',         // 状态订阅主题
        'liuxing23i/fan/control'  // 控制反馈主题
    ];

    topics.forEach(topic => {
        mqttClient.subscribe(topic, (err) => {
            if (err) {
                console.error('订阅主题失败:', topic, err);
            } else {
                console.log('成功订阅主题:', topic);
            }
        });
    });
}

// 处理MQTT消息
function handleMQTTMessage(topic, message) {
    try {
        const data = JSON.parse(message.toString());
        console.log('收到MQTT消息:', topic, data);
        
        if (topic === 'liuxing23i/fan') {
            // 如果是状态更新消息（包含temperature和humidity）
            if (data.temperature !== undefined || data.humidity !== undefined) {
                console.log('处理状态更新消息');
                updateUI(data);
            }
            // 处理预测完成消息
            if (data.prediction_complete !== undefined) {
                if (data.prediction_complete) {
                    // 开始冷却倒计时
                    let cooldownTime = 30; // 30秒冷却时间
                    updateUI({ prediction_status: 'cooldown', cooldown_time: cooldownTime });
                    
                    const cooldownInterval = setInterval(() => {
                        cooldownTime--;
                        if (cooldownTime <= 0) {
                            clearInterval(cooldownInterval);
                            updateUI({ prediction_status: 'ready' });
                        } else {
                            updateUI({ prediction_status: 'cooldown', cooldown_time: cooldownTime });
                        }
                    }, 1000);
                } else {
                    updateUI({ prediction_status: 'ready' });
                }
            }
        } else if (topic === 'liuxing23i/fan/control') {
            // 处理控制反馈消息
            if (data.type && data.value !== undefined) {
                console.log('处理控制反馈消息:', data.type, data.value);
                const updateData = {
                    [data.type]: data.value
                };
                console.log('准备更新UI数据:', updateData);
                updateUI(updateData);
            }
        }
    } catch (error) {
        console.error('处理MQTT消息失败:', error);
    }
}

// 初始化
console.log('开始初始化应用...');
connectMQTT(); 