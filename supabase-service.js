// Supabase数据存储服务类
class SupabaseService {
    constructor() {
        this.currentUser = null;
        this.init();
    }
    
    // 等待 supabase 加载完成
    waitForSupabase() {
        return new Promise((resolve) => {
            const checkSupabase = () => {
                if (window.supabase) {
                    resolve();
                } else {
                    setTimeout(checkSupabase, 100);
                }
            };
            checkSupabase();
        });
    }

    // 初始化服务
    async init() {
        console.log('SupabaseService 开始初始化...');
        
        // 等待 supabase 加载完成
        await this.waitForSupabase();
        console.log('Supabase 客户端已加载');
        
        // 监听用户认证状态
        window.supabase.auth.onAuthStateChange((event, session) => {
            console.log('认证状态变化:', event, session ? '有会话' : '无会话');
            this.currentUser = session?.user || null;
            if (this.currentUser) {
                console.log('用户已登录:', this.currentUser.email);
                this.onUserLogin(this.currentUser);
            } else {
                console.log('用户未登录');
                this.onUserLogout();
            }
        });
        
        console.log('SupabaseService 初始化完成');
    }

    // 用户登录
    async login(email, password) {
        try {
            console.log('SupabaseService.login 被调用:', { email, hasPassword: !!password });
            console.log('Supabase 客户端状态:', !!window.supabase);
            
            const { data, error } = await window.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            console.log('Supabase 登录响应:', { data, error });
            
            if (error) {
                console.error('登录错误:', error);
                // 检查是否是邮箱未确认错误
                if (error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')) {
                    return { 
                        success: false, 
                        error: '邮箱未确认，请检查邮箱并点击确认链接',
                        needsConfirmation: true
                    };
                }
                throw error;
            }
            console.log('登录成功:', data.user);
            return { success: true, user: data.user };
        } catch (error) {
            console.error('登录出错:', error);
            return { success: false, error: error.message };
        }
    }

    // 用户注册
    async register(email, password) {
        try {
            console.log('Supabase注册请求:', { email, password: '***' });
            const { data, error } = await window.supabase.auth.signUp({
                email: email,
                password: password
            }, {
                data: { 
                    disableEmailConfirmation: true  // 开发环境禁用邮件确认
                }
            });
            
            console.log('Supabase注册响应:', { data, error });
            
            if (error) {
                throw error;
            }
            
            return { success: true, user: data.user };
        } catch (error) {
            console.error('注册错误:', error);
            // 检查是否是安全限制错误
            if (error.message.includes('security purposes') || error.message.includes('Too Many Requests')) {
                return { 
                    success: false, 
                    error: '请求过于频繁，请等待30秒后重试',
                    isRateLimited: true
                };
            }
            
            return { success: false, error: error.message };
        }
    }

    // 用户登出
    async logout() {
        try {
            const { error } = await window.supabase.auth.signOut();
            if (error) throw error;
            this.currentUser = null;
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 修改密码
    async changePassword(currentPassword, newPassword) {
        try {
            if (!this.currentUser) {
                return { success: false, error: '用户未登录' };
            }

            // 先验证当前密码
            const { error: signInError } = await window.supabase.auth.signInWithPassword({
                email: this.currentUser.email,
                password: currentPassword
            });

            if (signInError) {
                return { success: false, error: '当前密码不正确' };
            }

            // 更新密码
            const { error: updateError } = await window.supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) {
                throw updateError;
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 忘记密码 - 发送重置邮件
    async resetPassword(email) {
        try {
            // 使用更通用的重定向URL
            const baseUrl = window.location.origin;
            const redirectUrl = `${baseUrl}/confirm.html?type=recovery`;
            
            console.log('发送密码重置邮件到:', email);
            console.log('重定向URL:', redirectUrl);
            
            const { error } = await window.supabase.auth.resetPasswordForEmail(email, {
                redirectTo: redirectUrl,
                emailRedirectTo: redirectUrl
            });

            if (error) {
                throw error;
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 保存排盘记录
    async savePaipanRecord(recordData) {
        if (!this.currentUser) {
            return { success: false, error: '用户未登录' };
        }

        try {
            console.log('保存到云端的数据:', recordData);
            
            const { data, error } = await window.supabase
                .from('paipan_records')
                .insert({
                    user_id: this.currentUser.id,
                    question: recordData.question,
                    time: recordData.time,
                    gua_data: {
                        yongshen: recordData.yongshen,
                        fullGuaContent: recordData.fullGuaContent,
                        timestamp: recordData.timestamp,
                        ...recordData.guaData
                    }
                })
                .select();
            
            if (error) {
                console.error('Supabase保存错误:', error);
                throw error;
            }
            
            console.log('云端保存成功:', data);
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('保存排盘记录出错:', error);
            return { success: false, error: error.message };
        }
    }

    // 获取排盘记录
    async getPaipanRecords() {
        if (!this.currentUser) {
            return { success: false, error: '用户未登录' };
        }

        try {
            const { data, error } = await window.supabase
                .from('paipan_records')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return { success: true, data: data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 删除排盘记录
    async deletePaipanRecord(recordId) {
        if (!this.currentUser) {
            return { success: false, error: '用户未登录' };
        }

        try {
            const { error } = await window.supabase
                .from('paipan_records')
                .delete()
                .eq('id', recordId)
                .eq('user_id', this.currentUser.id);
            
            if (error) throw error;
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 保存练习进度
    async savePracticeProgress(progressData) {
        if (!this.currentUser) {
            return { success: false, error: '用户未登录' };
        }

        try {
            const { data, error } = await window.supabase
                .from('practice_progress')
                .insert({
                    user_id: this.currentUser.id,
                    gua_id: progressData.guaId,
                    gua_name: progressData.guaName,
                    score: progressData.score,
                    time_spent: progressData.timeSpent,
                    completed_at: new Date().toISOString()
                })
                .select();
            
            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 获取练习进度
    async getPracticeProgress() {
        if (!this.currentUser) {
            return { success: false, error: '用户未登录' };
        }

        try {
            const { data, error } = await window.supabase
                .from('practice_progress')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .order('completed_at', { ascending: false });
            
            if (error) throw error;
            return { success: true, data: data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 保存电子书笔记
    async saveBookNote(noteData) {
        if (!this.currentUser) {
            return { success: false, error: '用户未登录' };
        }

        try {
            const { data, error } = await window.supabase
                .from('book_notes')
                .insert({
                    user_id: this.currentUser.id,
                    chapter_id: noteData.chapterId,
                    chapter_title: noteData.chapterTitle,
                    content: noteData.content,
                    highlights: noteData.highlights || [],
                    bookmarks: noteData.bookmarks || [],
                    created_at: new Date().toISOString()
                })
                .select();
            
            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 获取电子书笔记
    async getBookNotes() {
        if (!this.currentUser) {
            return { success: false, error: '用户未登录' };
        }

        try {
            const { data, error } = await window.supabase
                .from('book_notes')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return { success: true, data: data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 更新笔记
    async updateBookNote(noteId, noteData) {
        if (!this.currentUser) {
            return { success: false, error: '用户未登录' };
        }

        try {
            const { data, error } = await window.supabase
                .from('book_notes')
                .update({
                    ...noteData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', noteId)
                .eq('user_id', this.currentUser.id)
                .select();
            
            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 删除笔记
    async deleteBookNote(noteId) {
        if (!this.currentUser) {
            return { success: false, error: '用户未登录' };
        }

        try {
            const { error } = await window.supabase
                .from('book_notes')
                .delete()
                .eq('id', noteId)
                .eq('user_id', this.currentUser.id);
            
            if (error) throw error;
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 实时同步数据
    setupRealtimeSync(callback) {
        if (!this.currentUser) {
            return;
        }

        // 监听排盘记录变化
        const paipanSubscription = window.supabase
            .channel('paipan_records')
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'paipan_records',
                    filter: `user_id=eq.${this.currentUser.id}`
                }, 
                (payload) => {
                    callback('paipanRecords', payload);
                }
            )
            .subscribe();

        // 监听练习进度变化
        const practiceSubscription = window.supabase
            .channel('practice_progress')
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'practice_progress',
                    filter: `user_id=eq.${this.currentUser.id}`
                }, 
                (payload) => {
                    callback('practiceProgress', payload);
                }
            )
            .subscribe();

        // 监听笔记变化
        const notesSubscription = window.supabase
            .channel('book_notes')
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'book_notes',
                    filter: `user_id=eq.${this.currentUser.id}`
                }, 
                (payload) => {
                    callback('bookNotes', payload);
                }
            )
            .subscribe();
    }

    // 用户登录回调
    onUserLogin(user) {
        console.log('用户登录成功，开始同步数据...');
    }

    // 用户登出回调
    onUserLogout() {
        console.log('用户已登出');
    }
}

// 创建全局实例
window.supabaseService = new SupabaseService();
