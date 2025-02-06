// MQTT配置
const mqttConfig = {
    host: 's1202e81.ala.cn-hangzhou.emqxsl.cn',
    port: 8084,
    clientId: 'web_' + Math.random().toString(16).substring(2, 8),
    username: 'emqx',
    password: 'linjiajun1',
    protocol: 'wss',
    path: '/mqtt'
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
        document.getElementById('temperature').textContent = params.temperature.toFixed(1);
    }
    if (params.humidity !== undefined) {
        document.getElementById('humidity').textContent = params.humidity.toFixed(1);
    }
    if (params.light !== undefined) {
        document.getElementById('light').textContent = params.light;
    }
    if (params.led_brightness !== undefined) {
        const ledSlider = document.getElementById('ledBrightness');
        const ledValue = document.getElementById('ledBrightnessValue');
        ledSlider.value = params.led_brightness;
        ledValue.textContent = params.led_brightness;
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
            console.log('更新UI数据:', data);
            updateUI(data);
        } else if (topic === 'liuxing23i/fan/control') {
            console.log('收到控制反馈:', data);
        }
    } catch (error) {
        console.error('处理MQTT消息失败:', error);
    }
}

// 更新MQTT状态显示
function updateMQTTStatus(status, message) {
    const statusElement = document.getElementById('mqttStatus');
    statusElement.className = 'mqtt-status';
    
    switch (status) {
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

        // 确保先断开之前的连接
        if (mqttClient) {
            mqttClient.end(true);
            mqttClient = null;
        }

        const wsUrl = `${mqttConfig.protocol}://${mqttConfig.host}:${mqttConfig.port}/mqtt`;
        console.log('MQTT连接URL:', wsUrl);
        
        const options = {
            clientId: mqttConfig.clientId,
            username: mqttConfig.username,
            password: mqttConfig.password,
            clean: true,
            rejectUnauthorized: false,
            reconnectPeriod: 5000,
            connectTimeout: 30000,
            keepalive: 60
        };

        mqttClient = mqtt.connect(wsUrl, options);
        
        mqttClient.on('connect', () => {
            console.log('MQTT连接成功');
            updateMQTTStatus('connected');
            subscribeToTopics();
            // 连接成功后立即请求一次数据
            sendMQTTControl('request_data', true);
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
        mqttClient.subscribe(topic, { qos: 1 }, (err) => {
            if (err) {
                console.error('订阅主题失败:', topic, err);
            } else {
                console.log('成功订阅主题:', topic);
            }
        });
    });
}

// LED亮度控制
const debouncedSendLEDBrightness = debounce((value) => {
    sendMQTTControl('led_brightness', value);
}, 300);

// 风扇控制
document.getElementById('fanSwitch').addEventListener('change', function(e) {
    sendMQTTControl('fan_switch', e.target.checked);
});

const debouncedSendFanSpeed = debounce((value) => {
    sendMQTTControl('fan_speed', value);
}, 300);

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

// 初始化函数：设置所有事件监听器
function initializeEventListeners() {
    // LED亮度控制
    const ledBrightness = document.getElementById('ledBrightness');
    const ledBrightnessValue = document.getElementById('ledBrightnessValue');
    if (ledBrightness && ledBrightnessValue) {
        ledBrightness.addEventListener('input', function(e) {
            const value = parseInt(e.target.value);
            ledBrightnessValue.textContent = value;
        });

        ledBrightness.addEventListener('change', function(e) {
            const value = parseInt(e.target.value);
            debouncedSendLEDBrightness(value);
        });
    }

    // 风扇控制
    const fanSwitch = document.getElementById('fanSwitch');
    if (fanSwitch) {
        fanSwitch.addEventListener('change', function(e) {
            sendMQTTControl('fan_switch', e.target.checked);
        });
    }

    // 风扇速度控制
    const fanSpeed = document.getElementById('fanSpeed');
    const fanSpeedValue = document.getElementById('fanSpeedValue');
    if (fanSpeed && fanSpeedValue) {
        fanSpeed.addEventListener('input', function(e) {
            const value = parseInt(e.target.value);
            fanSpeedValue.textContent = value;
        });

        fanSpeed.addEventListener('change', function(e) {
            const value = parseInt(e.target.value);
            debouncedSendFanSpeed(value);
        });
    }

    // 预测模式控制
    const predictModeRadios = document.querySelectorAll('input[name="predictMode"]');
    const manualForm = document.getElementById('manualInputForm');
    if (predictModeRadios.length && manualForm) {
        predictModeRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                manualForm.style.display = this.value === 'manual' ? 'block' : 'none';
            });
        });
    }

    // 预测按钮
    const predictBtn = document.getElementById('predictBtn');
    if (predictBtn) {
        predictBtn.addEventListener('click', function() {
            const mode = document.querySelector('input[name="predictMode"]:checked')?.value;
            if (!mode) return;
            
            let predictData = {};
            
            if (mode === 'manual') {
                // 获取手动输入的数据
                const temp = parseFloat(document.getElementById('manualTemp')?.value);
                const humidity = parseFloat(document.getElementById('manualHumidity')?.value);
                const light = parseFloat(document.getElementById('manualLight')?.value);
                const hour = parseInt(document.getElementById('manualHour')?.value);
                
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
    }
}

// 修改初始化部分
function initializePage() {
    console.log('初始化控制页面...');
    
    // 确保MQTT客户端库已加载
    if (typeof mqtt === 'undefined') {
        console.error('MQTT客户端库未加载！');
        setTimeout(initializePage, 1000); // 1秒后重试
        return;
    }
    
    initializeEventListeners();
    connectMQTT();
}

// 等待页面加载完成
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}

// 添加页面可见性变化监听
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // 页面变为可见时，检查MQTT连接
        if (!mqttClient || !mqttClient.connected) {
            console.log('页面可见，重新连接MQTT...');
            connectMQTT();
        }
    }
});

// 添加页面卸载事件监听
window.addEventListener('beforeunload', () => {
    if (mqttClient) {
        mqttClient.end();
    }
}); 