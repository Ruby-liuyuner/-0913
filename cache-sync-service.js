// 缓存同步服务类 - 改进的云端笔记缓存同步机制
class CacheSyncService {
    constructor() {
        this.syncQueue = []; // 同步队列
        this.isOnline = navigator.onLine;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.syncInProgress = false;
        this.init();
    }

    // 初始化服务
    init() {
        // 监听网络状态
        window.addEventListener('online', () => {
            console.log('网络已连接，开始同步待同步的数据');
            this.isOnline = true;
            this.processSyncQueue();
        });

        window.addEventListener('offline', () => {
            console.log('网络已断开，数据将保存到本地队列');
            this.isOnline = false;
        });

        // 定期检查同步状态
        setInterval(() => {
            this.checkSyncStatus();
        }, 30000); // 每30秒检查一次

        console.log('CacheSyncService 初始化完成');
    }

    // 检查同步状态
    async checkSyncStatus() {
        if (this.syncQueue.length > 0 && this.isOnline && !this.syncInProgress) {
            console.log(`发现 ${this.syncQueue.length} 个待同步项目，开始同步`);
            await this.processSyncQueue();
        }
    }

    // 添加同步任务到队列
    addToSyncQueue(operation, data, retryCount = 0) {
        const syncItem = {
            id: Date.now() + Math.random(),
            operation, // 'save', 'update', 'delete'
            data,
            retryCount,
            timestamp: new Date().toISOString()
        };

        this.syncQueue.push(syncItem);
        console.log('添加到同步队列:', syncItem);

        // 如果在线，立即尝试同步
        if (this.isOnline) {
            this.processSyncQueue();
        }
    }

    // 处理同步队列
    async processSyncQueue() {
        if (this.syncInProgress || this.syncQueue.length === 0) {
            return;
        }

        this.syncInProgress = true;
        console.log(`开始处理同步队列，共 ${this.syncQueue.length} 个项目`);

        const itemsToProcess = [...this.syncQueue];
        this.syncQueue = [];

        for (const item of itemsToProcess) {
            try {
                const success = await this.executeSyncOperation(item);
                
                if (!success && item.retryCount < this.maxRetries) {
                    // 同步失败，重新加入队列
                    item.retryCount++;
                    this.syncQueue.push(item);
                    console.log(`同步失败，重新加入队列 (重试 ${item.retryCount}/${this.maxRetries}):`, item);
                } else if (!success) {
                    console.error('同步失败，已达到最大重试次数:', item);
                    // 可以在这里添加失败通知机制
                } else {
                    console.log('同步成功:', item);
                }
            } catch (error) {
                console.error('同步过程中出错:', error);
                if (item.retryCount < this.maxRetries) {
                    item.retryCount++;
                    this.syncQueue.push(item);
                }
            }
        }

        this.syncInProgress = false;
        console.log(`同步队列处理完成，剩余 ${this.syncQueue.length} 个项目`);
    }

    // 执行同步操作
    async executeSyncOperation(item) {
        try {
            if (!window.supabaseService || !window.supabaseService.currentUser) {
                console.log('用户未登录，无法同步');
                return false;
            }

            let result;
            switch (item.operation) {
                case 'save':
                    result = await window.supabaseService.saveBookNote(item.data);
                    break;
                case 'update':
                    result = await window.supabaseService.updateBookNote(item.data.noteId, item.data);
                    break;
                case 'delete':
                    result = await window.supabaseService.deleteBookNote(item.data.noteId);
                    break;
                default:
                    console.error('未知的同步操作:', item.operation);
                    return false;
            }

            return result.success;
        } catch (error) {
            console.error('同步操作执行失败:', error);
            return false;
        }
    }

    // 保存笔记（带缓存同步）
    async saveNote(noteData) {
        // 先保存到本地
        const localNoteId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const localData = {
            ...noteData,
            id: localNoteId,
            uploaded: false,
            lastModified: new Date().toISOString()
        };

        localStorage.setItem(localNoteId, JSON.stringify(localData));
        console.log('笔记已保存到本地:', localNoteId);

        // 添加到同步队列
        this.addToSyncQueue('save', noteData);

        return localNoteId;
    }

    // 更新笔记（带缓存同步）
    async updateNote(noteId, noteData) {
        // 更新本地数据
        const localData = {
            ...noteData,
            id: noteId,
            uploaded: false,
            lastModified: new Date().toISOString()
        };

        localStorage.setItem(noteId, JSON.stringify(localData));
        console.log('笔记已更新到本地:', noteId);

        // 添加到同步队列
        this.addToSyncQueue('update', { noteId, ...noteData });

        return true;
    }

    // 删除笔记（带缓存同步）
    async deleteNote(noteId) {
        // 从本地删除
        localStorage.removeItem(noteId);
        console.log('笔记已从本地删除:', noteId);

        // 添加到同步队列
        this.addToSyncQueue('delete', { noteId });

        return true;
    }

    // 获取所有笔记（优先从云端，离线时从本地）
    async getAllNotes() {
        if (this.isOnline && window.supabaseService && window.supabaseService.currentUser) {
            try {
                // 尝试从云端获取
                const result = await window.supabaseService.getBookNotes();
                if (result.success) {
                    console.log('从云端获取笔记成功:', result.data.length);
                    
                    // 将云端数据缓存到本地
                    result.data.forEach(cloudNote => {
                        const localNoteId = `note_${cloudNote.id}`;
                        const localData = {
                            text: cloudNote.highlights?.[0]?.text || '',
                            note: cloudNote.content,
                            timestamp: cloudNote.created_at,
                            cloudId: cloudNote.id,
                            uploaded: true,
                            lastModified: cloudNote.updated_at || cloudNote.created_at
                        };
                        localStorage.setItem(localNoteId, JSON.stringify(localData));
                    });

                    return result.data;
                }
            } catch (error) {
                console.error('从云端获取笔记失败，使用本地缓存:', error);
            }
        }

        // 从本地获取
        const localNotes = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('note_')) {
                try {
                    const noteData = JSON.parse(localStorage.getItem(key));
                    localNotes.push(noteData);
                } catch (error) {
                    console.error('解析本地笔记失败:', key, error);
                }
            }
        }

        console.log('从本地获取笔记:', localNotes.length);
        return localNotes;
    }

    // 强制同步所有本地数据
    async forceSyncAll() {
        console.log('开始强制同步所有本地数据');
        
        const localNotes = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('note_')) {
                try {
                    const noteData = JSON.parse(localStorage.getItem(key));
                    if (!noteData.uploaded) {
                        localNotes.push({ key, data: noteData });
                    }
                } catch (error) {
                    console.error('解析本地笔记失败:', key, error);
                }
            }
        }

        console.log(`发现 ${localNotes.length} 个未同步的本地笔记`);

        for (const { key, data } of localNotes) {
            const noteData = {
                chapterId: data.chapterId || 'default',
                chapterTitle: data.chapterTitle || '默认章节',
                content: data.note || '',
                highlights: data.text ? [{ text: data.text }] : []
            };
            
            this.addToSyncQueue('save', noteData);
        }

        await this.processSyncQueue();
    }

    // 获取同步状态
    getSyncStatus() {
        return {
            isOnline: this.isOnline,
            queueLength: this.syncQueue.length,
            syncInProgress: this.syncInProgress,
            retryCount: this.retryCount
        };
    }
}

// 创建全局实例
window.cacheSyncService = new CacheSyncService();
