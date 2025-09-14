// 同步状态显示组件
class SyncStatusWidget {
    constructor() {
        this.widget = null;
        this.isVisible = false;
        this.updateInterval = null;
        this.init();
    }

    // 初始化组件
    init() {
        this.createWidget();
        this.startStatusUpdates();
        console.log('SyncStatusWidget 初始化完成');
    }

    // 创建状态显示组件
    createWidget() {
        // 创建主容器
        this.widget = document.createElement('div');
        this.widget.id = 'sync-status-widget';
        this.widget.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 12px 16px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            min-width: 200px;
            display: none;
            transition: all 0.3s ease;
        `;

        // 创建状态指示器
        const statusIndicator = document.createElement('div');
        statusIndicator.id = 'sync-status-indicator';
        statusIndicator.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        `;

        const statusDot = document.createElement('div');
        statusDot.id = 'sync-status-dot';
        statusDot.style.cssText = `
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 8px;
            background: #28a745;
            animation: pulse 2s infinite;
        `;

        const statusText = document.createElement('span');
        statusText.id = 'sync-status-text';
        statusText.textContent = '云端同步正常';

        statusIndicator.appendChild(statusDot);
        statusIndicator.appendChild(statusText);

        // 创建详细信息
        const details = document.createElement('div');
        details.id = 'sync-status-details';
        details.style.cssText = `
            font-size: 12px;
            color: #666;
            margin-top: 4px;
        `;

        // 创建操作按钮
        const actions = document.createElement('div');
        actions.style.cssText = `
            margin-top: 8px;
            display: flex;
            gap: 8px;
        `;

        const syncButton = document.createElement('button');
        syncButton.textContent = '立即同步';
        syncButton.style.cssText = `
            background: #007bff;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
        `;
        syncButton.onclick = () => this.forceSync();

        const closeButton = document.createElement('button');
        closeButton.textContent = '关闭';
        closeButton.style.cssText = `
            background: #6c757d;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
        `;
        closeButton.onclick = () => this.hide();

        actions.appendChild(syncButton);
        actions.appendChild(closeButton);

        // 组装组件
        this.widget.appendChild(statusIndicator);
        this.widget.appendChild(details);
        this.widget.appendChild(actions);

        // 添加到页面
        document.body.appendChild(this.widget);

        // 添加CSS动画
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
            
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            .sync-loading {
                animation: spin 1s linear infinite;
            }
        `;
        document.head.appendChild(style);
    }

    // 开始状态更新
    startStatusUpdates() {
        this.updateInterval = setInterval(() => {
            this.updateStatus();
        }, 5000); // 每5秒更新一次

        // 立即更新一次
        this.updateStatus();
    }

    // 更新同步状态
    updateStatus() {
        if (!window.cacheSyncService) {
            return;
        }

        const status = window.cacheSyncService.getSyncStatus();
        const statusDot = document.getElementById('sync-status-dot');
        const statusText = document.getElementById('sync-status-text');
        const details = document.getElementById('sync-status-details');

        if (!statusDot || !statusText || !details) {
            return;
        }

        // 更新状态指示器
        if (status.syncInProgress) {
            statusDot.style.background = '#ffc107';
            statusDot.className = 'sync-loading';
            statusText.textContent = '正在同步...';
            details.textContent = `队列中还有 ${status.queueLength} 个项目`;
        } else if (status.queueLength > 0) {
            statusDot.style.background = '#ffc107';
            statusDot.className = '';
            statusText.textContent = '待同步';
            details.textContent = `${status.queueLength} 个项目等待同步`;
        } else if (status.isOnline) {
            statusDot.style.background = '#28a745';
            statusDot.className = '';
            statusText.textContent = '云端同步正常';
            details.textContent = '所有数据已同步';
        } else {
            statusDot.style.background = '#dc3545';
            statusDot.className = '';
            statusText.textContent = '离线模式';
            details.textContent = '网络连接已断开，数据已缓存';
        }

        // 如果有待同步的项目或正在同步，显示组件
        if (status.queueLength > 0 || status.syncInProgress) {
            this.show();
        } else if (status.isOnline && status.queueLength === 0) {
            // 如果在线且没有待同步项目，3秒后自动隐藏
            setTimeout(() => {
                if (status.queueLength === 0 && !status.syncInProgress) {
                    this.hide();
                }
            }, 3000);
        }
    }

    // 显示组件
    show() {
        if (this.widget) {
            this.widget.style.display = 'block';
            this.isVisible = true;
        }
    }

    // 隐藏组件
    hide() {
        if (this.widget) {
            this.widget.style.display = 'none';
            this.isVisible = false;
        }
    }

    // 强制同步
    async forceSync() {
        if (window.cacheSyncService) {
            console.log('用户触发强制同步');
            await window.cacheSyncService.forceSyncAll();
            this.updateStatus();
        }
    }

    // 销毁组件
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        if (this.widget && this.widget.parentNode) {
            this.widget.parentNode.removeChild(this.widget);
        }
    }
}

// 创建全局实例
window.syncStatusWidget = new SyncStatusWidget();
