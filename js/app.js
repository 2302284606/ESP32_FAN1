// MQTT配置
const mqttConfig = {
    host: 's1202e81.ala.cn-hangzhou.emqxsl.cn',
    port: 8084,
    clientId: 'web_control_' + Math.random().toString(16).substring(2, 8),
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
        document.getElementById('temperature').textContent = params.temperature.toFixed(1) + '°C';
    }
    if (params.humidity !== undefined) {
        document.getElementById('humidity').textContent = params.humidity.toFixed(1) + '%';
    }
    if (params.light !== undefined) {
        document.getElementById('light').textContent = params.light + ' lx';
    }
    if (params.led !== undefined) {
        document.getElementById('ledSwitch').checked = params.led;
    }
    if (params.fan_switch !== undefined) {
        document.getElementById('fanSwitch').checked = params.fan_switch;
    }
    if (params.fan_speed !== undefined) {
        const speedSlider = document.getElementById('fanSpeed');
        const speedValue = document.getElementById('fanSpeedValue');
        speedSlider.value = params.fan_speed;
        speedValue.textContent = params.fan_speed;
    }
    if (params.cpu_temp !== undefined) {
        document.getElementById('cpuTemp').textContent = params.cpu_temp.toFixed(1) + '°C';
    }
    if (params.cpu_freq !== undefined) {
        document.getElementById('cpuFreq').textContent = params.cpu_freq + 'MHz';
    }
    if (params.memory_usage !== undefined) {
        document.getElementById('memoryUsage').textContent = params.memory_usage.toFixed(1) + '%';
    }
    if (params.uptime !== undefined) {
        const hours = Math.floor(params.uptime / 3600);
        const minutes = Math.floor((params.uptime % 3600) / 60);
        const seconds = params.uptime % 60;
        document.getElementById('uptime').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    if (params.prediction_status !== undefined) {
        const predictBtn = document.getElementById('predictBtn');
        predictBtn.disabled = params.prediction_status === 'running';
        predictBtn.textContent = params.prediction_status === 'running' ? '预测中...' : '开始预测';
    }
    if (params.led_brightness !== undefined) {
        const ledSlider = document.getElementById('ledBrightness');
        const ledValue = document.getElementById('ledBrightnessValue');
        ledSlider.value = params.led_brightness;
        ledValue.textContent = params.led_brightness;
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
            } else {
                console.log('控制命令发送成功');
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }
        });
    } catch (error) {
        console.error('发送控制命令失败:', error);
    }
}

// 处理MQTT消息
function handleMQTTMessage(topic, message) {
    try {
        const data = JSON.parse(message.toString());
        console.log('收到MQTT消息:', topic, data);
        
        if (topic === 'liuxing23i/fan/data') {
            // 更新传感器数据显示
            if (data.temperature !== undefined) {
                document.getElementById('temperature').textContent = 
                    data.temperature.toFixed(1) + '°C';
            }
            if (data.humidity !== undefined) {
                document.getElementById('humidity').textContent = 
                    data.humidity.toFixed(1) + '%';
            }
            if (data.light !== undefined) {
                document.getElementById('light').textContent = 
                    data.light + ' lx';
            }
            
            // 更新控制状态
            if (data.led !== undefined) {
                document.getElementById('ledSwitch').checked = data.led;
            }
            if (data.fan_switch !== undefined) {
                document.getElementById('fanSwitch').checked = data.fan_switch;
            }
            if (data.fan_speed !== undefined) {
                const speedSlider = document.getElementById('fanSpeed');
                const speedValue = document.getElementById('fanSpeedValue');
                speedSlider.value = data.fan_speed;
                speedValue.textContent = data.fan_speed;
            }
            
            // 更新系统状态
            if (data.cpu_temp !== undefined) {
                document.getElementById('cpuTemp').textContent = 
                    data.cpu_temp.toFixed(1) + '°C';
            }
            if (data.cpu_freq !== undefined) {
                document.getElementById('cpuFreq').textContent = 
                    data.cpu_freq + 'MHz';
            }
            if (data.memory_usage !== undefined) {
                document.getElementById('memoryUsage').textContent = 
                    data.memory_usage.toFixed(1) + '%';
            }
            if (data.uptime !== undefined) {
                const hours = Math.floor(data.uptime / 3600);
                const minutes = Math.floor((data.uptime % 3600) / 60);
                const seconds = data.uptime % 60;
                document.getElementById('uptime').textContent = 
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }
        else if (topic === 'liuxing23i/fan/control') {
            if (data.type && data.value !== undefined) {
                const updateData = {
                    [data.type]: data.value
                };
                updateUI(updateData);
            }
        }
        
    } catch (error) {
        console.error('处理MQTT消息失败:', error);
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
            subscribeToTopics();
        });

        mqttClient.on('error', (error) => {
            console.error('MQTT错误:', error);
            updateMQTTStatus('disconnected', 'MQTT错误');
        });

        mqttClient.on('message', handleMQTTMessage);

        mqttClient.on('close', () => {
            console.log('MQTT连接已断开');
            updateMQTTStatus('disconnected');
        });

        mqttClient.on('reconnect', () => {
            console.log('MQTT重新连接中...');
            updateMQTTStatus('connecting');
        });

    } catch (error) {
        console.error('MQTT连接失败:', error);
        updateMQTTStatus('disconnected', 'MQTT连接失败');
    }
}

// 订阅主题
function subscribeToTopics() {
    const topics = [
        'liuxing23i/fan/data',      // 传感器数据
        'liuxing23i/fan/control'    // 控制反馈
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

// 绑定UI事件
document.getElementById('ledSwitch').addEventListener('change', function(e) {
    sendMQTTControl('led', e.target.checked);
});

document.getElementById('fanSwitch').addEventListener('change', function(e) {
    sendMQTTControl('fan_switch', e.target.checked);
});

const debouncedSendFanSpeed = debounce((value) => {
    sendMQTTControl('fan_speed', value);
}, 300);

document.getElementById('fanSpeed').addEventListener('input', function(e) {
    const value = parseInt(e.target.value);
    document.getElementById('fanSpeedValue').textContent = value;
});

document.getElementById('fanSpeed').addEventListener('change', function(e) {
    const value = parseInt(e.target.value);
    debouncedSendFanSpeed(value);
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

// LED亮度控制
const debouncedSendLEDBrightness = debounce((value) => {
    sendMQTTControl('led_brightness', value);
}, 300);

document.getElementById('ledBrightness').addEventListener('input', function(e) {
    const value = parseInt(e.target.value);
    document.getElementById('ledBrightnessValue').textContent = value;
});

document.getElementById('ledBrightness').addEventListener('change', function(e) {
    const value = parseInt(e.target.value);
    debouncedSendLEDBrightness(value);
});

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('初始化控制页面...');
    connectMQTT();
}); 