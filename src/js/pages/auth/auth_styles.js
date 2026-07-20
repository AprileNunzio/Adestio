const AuthStyles = {
    getStyles: () => {
        try {
            return `
                <style>
                    .auth-wrapper {
                        width: 100%;
                        max-width: 680px;
                        margin: auto;
                        padding: 2.5rem;
                        background: rgba(255, 255, 255, 0.85);
                        backdrop-filter: blur(20px);
                        border: 1px solid rgba(0, 0, 0, 0.1);
                        border-radius: 24px;
                        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        text-align: center;
                        box-sizing: border-box;
                        transition: all 0.3s ease;
                    }
                    .auth-header {
                        margin-bottom: 2rem;
                        width: 100%;
                    }
                    .brand-logo {
                        width: 72px;
                        height: 72px;
                        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                        color: #ffffff;
                        border-radius: 20px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 1.2rem auto;
                        box-shadow: 0 8px 20px rgba(59, 130, 246, 0.25);
                    }
                    .brand-logo span {
                        font-size: 2.5rem;
                    }
                    .text-title {
                        font-size: 2rem;
                        font-weight: 700;
                        color: #1e293b;
                        margin: 0 0 0.4rem 0;
                        letter-spacing: -0.5px;
                    }
                    .text-subtitle {
                        font-size: 1rem;
                        color: #475569;
                        margin: 0;
                    }
                    .users-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                        gap: 1.2rem;
                        width: 100%;
                        margin-bottom: 1.5rem;
                    }
                    .user-card {
                        background: rgba(241, 245, 249, 0.8);
                        border: 1px solid rgba(0, 0, 0, 0.1);
                        border-radius: 16px;
                        padding: 1.5rem 1rem;
                        cursor: pointer;
                        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 0.8rem;
                        position: relative;
                        overflow: hidden;
                        box-sizing: border-box;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
                    }
                    .user-card:hover {
                        transform: translateY(-4px);
                        background: rgba(255, 255, 255, 0.95);
                        border-color: #3b82f6;
                        box-shadow: 0 12px 24px rgba(59, 130, 246, 0.12);
                    }
                    .user-card.selected {
                        border-color: #3b82f6;
                        background: rgba(59, 130, 246, 0.08);
                        box-shadow: 0 0 0 2px #3b82f6, 0 8px 20px rgba(59, 130, 246, 0.15);
                    }
                    .user-avatar {
                        width: 64px;
                        height: 64px;
                        background: linear-gradient(135deg, #4f46e5, #3b82f6);
                        color: #ffffff;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 1.8rem;
                        font-weight: 600;
                        box-shadow: 0 4px 10px rgba(59, 130, 246, 0.2);
                    }
                    .user-name {
                        font-weight: 600;
                        color: #1e293b;
                        font-size: 1.1rem;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        max-width: 100%;
                    }
                    .user-badge {
                        font-size: 0.75rem;
                        padding: 0.25rem 0.75rem;
                        border-radius: 12px;
                        background: rgba(0, 0, 0, 0.06);
                        color: #475569;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        font-weight: 600;
                    }
                    .btn-more-users {
                        width: 100%;
                        padding: 1rem;
                        border-radius: 14px;
                        background: rgba(241, 245, 249, 0.8);
                        border: 1px dashed rgba(0, 0, 0, 0.2);
                        color: #1e293b;
                        font-size: 1rem;
                        font-weight: 500;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 0.8rem;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        margin-bottom: 2rem;
                        box-sizing: border-box;
                    }
                    .btn-more-users:hover {
                        background: rgba(59, 130, 246, 0.06);
                        border-color: #3b82f6;
                        color: #3b82f6;
                    }
                    .login-container {
                        width: 100%;
                        background: rgba(241, 245, 249, 0.8);
                        border: 1px solid rgba(0, 0, 0, 0.1);
                        border-radius: 18px;
                        padding: 1.8rem;
                        margin-bottom: 2rem;
                        box-sizing: border-box;
                        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
                    }
                    .selected-user-banner {
                        display: flex;
                        align-items: center;
                        gap: 1rem;
                        padding-bottom: 1.5rem;
                        margin-bottom: 1.5rem;
                        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                        text-align: left;
                    }
                    .banner-avatar {
                        width: 50px;
                        height: 50px;
                        border-radius: 50%;
                        background: #3b82f6;
                        color: #fff;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 1.4rem;
                        font-weight: bold;
                    }
                    .banner-info {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                    }
                    .banner-name {
                        font-size: 1.2rem;
                        font-weight: 600;
                        color: #1e293b;
                    }
                    .banner-role {
                        font-size: 0.85rem;
                        color: #475569;
                    }
                    .btn-change {
                        background: rgba(255, 255, 255, 0.9);
                        border: 1px solid rgba(0, 0, 0, 0.15);
                        color: #475569;
                        padding: 0.4rem 0.8rem;
                        border-radius: 8px;
                        font-size: 0.85rem;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .btn-change:hover {
                        background: rgba(0, 0, 0, 0.05);
                        color: #1e293b;
                    }
                    .pin-instruction {
                        color: #475569;
                        font-size: 0.95rem;
                        margin-bottom: 1.2rem;
                    }
                    .pin-grid {
                        display: flex;
                        gap: 0.6rem;
                        justify-content: center;
                        flex-wrap: wrap;
                    }
                    .pin-box {
                        width: 48px;
                        height: 60px;
                        font-size: 1.8rem;
                        font-weight: bold;
                        text-align: center;
                        border: 2px solid rgba(0, 0, 0, 0.15);
                        border-radius: 12px;
                        background: #ffffff;
                        color: #1e293b;
                        outline: none;
                        transition: all 0.2s ease;
                        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.02);
                    }
                    .pin-box:focus {
                        border-color: #3b82f6;
                        background: rgba(59, 130, 246, 0.05);
                        box-shadow: 0 0 10px rgba(59, 130, 246, 0.2);
                    }
                    .pin-error {
                        animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
                        border-color: #ef4444 !important;
                    }
                    .form-warning {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 0.6rem;
                        color: #d97706;
                        font-size: 0.9rem;
                        margin-bottom: 1.2rem;
                        font-weight: 600;
                    }
                    .input-group {
                        position: relative;
                        margin-bottom: 1.2rem;
                    }
                    .input-icon {
                        position: absolute;
                        left: 1rem;
                        top: 50%;
                        transform: translateY(-50%);
                        color: #475569;
                    }
                    .input-field {
                        width: 100%;
                        padding: 1rem 1rem 1rem 3rem;
                        border-radius: 12px;
                        border: 1px solid rgba(0, 0, 0, 0.15);
                        background: #ffffff;
                        color: #1e293b;
                        font-size: 1rem;
                        outline: none;
                        box-sizing: border-box;
                        transition: border 0.2s;
                    }
                    .input-field:focus {
                        border-color: #3b82f6;
                        box-shadow: 0 0 8px rgba(59, 130, 246, 0.15);
                    }
                    .btn-submit {
                        width: 100%;
                        padding: 1rem;
                        border-radius: 12px;
                        background: #3b82f6;
                        color: #fff;
                        font-size: 1rem;
                        font-weight: 600;
                        border: none;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 0.5rem;
                        transition: background 0.2s;
                        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
                    }
                    .btn-submit:hover {
                        background: #2563eb;
                    }
                    .auth-footer {
                        margin-top: auto;
                    }
                    .btn-reset {
                        background: transparent;
                        border: none;
                        color: #475569;
                        font-size: 0.9rem;
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        cursor: pointer;
                        opacity: 0.8;
                        transition: all 0.2s;
                    }
                    .btn-reset:hover {
                        opacity: 1;
                        color: #ef4444;
                    }
                    .search-modal {
                        position: fixed;
                        top: 0; left: 0; right: 0; bottom: 0;
                        background: rgba(15, 23, 42, 0.55);
                        backdrop-filter: blur(10px);
                        z-index: 9999;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 1.5rem;
                        box-sizing: border-box;
                    }
                    .modal-content {
                        width: 100%;
                        max-width: 600px;
                        max-height: 85vh;
                        background: #ffffff;
                        border: 1px solid rgba(0, 0, 0, 0.1);
                        border-radius: 24px;
                        padding: 2rem;
                        display: flex;
                        flex-direction: column;
                        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
                        box-sizing: border-box;
                    }
                    .modal-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        margin-bottom: 1.5rem;
                    }
                    .modal-title-box {
                        display: flex;
                        align-items: center;
                        gap: 0.8rem;
                        color: #1e293b;
                    }
                    .modal-title-box h2 {
                        margin: 0;
                        font-size: 1.5rem;
                    }
                    .btn-icon {
                        background: rgba(241, 245, 249, 0.8);
                        border: 1px solid rgba(0, 0, 0, 0.1);
                        color: #1e293b;
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: background 0.2s;
                    }
                    .btn-icon:hover {
                        background: rgba(0, 0, 0, 0.08);
                    }
                    .search-bar-box {
                        position: relative;
                        margin-bottom: 1.5rem;
                    }
                    .search-icon {
                        position: absolute;
                        left: 1.2rem;
                        top: 50%;
                        transform: translateY(-50%);
                        color: #475569;
                        font-size: 1.4rem;
                    }
                    .search-input {
                        width: 100%;
                        padding: 1rem 1rem 1rem 3.5rem;
                        border-radius: 14px;
                        border: 1px solid rgba(0, 0, 0, 0.15);
                        background: rgba(241, 245, 249, 0.8);
                        color: #1e293b;
                        font-size: 1rem;
                        outline: none;
                        box-sizing: border-box;
                        transition: all 0.2s;
                    }
                    .search-input:focus {
                        border-color: #3b82f6;
                        background: #ffffff;
                        box-shadow: 0 0 8px rgba(59, 130, 246, 0.15);
                    }
                    .modal-grid {
                        display: flex;
                        flex-direction: column;
                        gap: 0.8rem;
                        overflow-y: auto;
                        max-height: 45vh;
                        padding-right: 0.5rem;
                    }
                    .modal-user-card {
                        display: flex;
                        align-items: center;
                        gap: 1rem;
                        padding: 1rem 1.2rem;
                        background: rgba(241, 245, 249, 0.8);
                        border: 1px solid rgba(0, 0, 0, 0.08);
                        border-radius: 14px;
                        cursor: pointer;
                        transition: all 0.2s;
                        text-align: left;
                    }
                    .modal-user-card:hover {
                        background: #ffffff;
                        border-color: #3b82f6;
                        transform: translateX(4px);
                        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
                    }
                    .modal-avatar {
                        width: 44px;
                        height: 44px;
                        border-radius: 50%;
                        background: #3b82f6;
                        color: #fff;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 1.2rem;
                    }
                    .modal-user-info {
                        flex: 1;
                    }
                    .modal-username {
                        color: #1e293b;
                        font-weight: 600;
                        font-size: 1.05rem;
                    }
                    .modal-fullname {
                        color: #475569;
                        font-size: 0.85rem;
                    }
                    .arrow-icon {
                        color: #475569;
                        font-size: 1.1rem;
                    }
                    .no-results {
                        text-align: center;
                        padding: 3rem 1rem;
                        color: #475569;
                    }
                    .no-results span {
                        font-size: 3rem;
                        margin-bottom: 0.5rem;
                        opacity: 0.5;
                    }
                    .card-status {
                        max-width: 450px;
                        margin: 2rem auto;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 1rem;
                    }
                    .icon-large {
                        font-size: 4rem;
                    }
                    .status-error .icon-large { color: #ef4444; }
                    .status-warning .icon-large { color: #d97706; }
                    .btn-action {
                        padding: 1rem 1.5rem;
                        border-radius: 12px;
                        border: none;
                        font-weight: 600;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 0.6rem;
                        margin-top: 1rem;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    }
                    .btn-danger { background: #ef4444; color: #fff; }
                    .btn-primary { background: #3b82f6; color: #fff; }
                    @keyframes shake {
                        10%, 90% { transform: translate3d(-1px, 0, 0); }
                        20%, 80% { transform: translate3d(2px, 0, 0); }
                        30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
                        40%, 60% { transform: translate3d(4px, 0, 0); }
                    }
                    @media (max-width: 640px) {
                        .auth-wrapper {
                            padding: 1.5rem;
                            border-radius: 16px;
                        }
                        .text-title {
                            font-size: 1.6rem;
                        }
                        .users-grid {
                            grid-template-columns: 1fr;
                        }
                        .pin-box {
                            width: 40px;
                            height: 52px;
                            font-size: 1.5rem;
                        }
                        .modal-content {
                            padding: 1.2rem;
                            max-height: 90vh;
                        }
                    }
                    @media (max-height: 768px) {
                        .auth-wrapper {
                            padding: 1.5rem;
                        }
                        .auth-header {
                            margin-bottom: 1.2rem;
                        }
                        .brand-logo {
                            width: 56px;
                            height: 56px;
                            margin-bottom: 0.8rem;
                        }
                        .brand-logo span {
                            font-size: 2rem;
                        }
                    }
                </style>
            `;
        } catch (_) {
            return '';
        }
    }
};
export default AuthStyles;
