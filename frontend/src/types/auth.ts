export interface User {
    user_id: string;
    email: string;
    name: string;
}

export interface AuthState {
    user: User | null;
    isLoading: boolean;
    error: Error | null;
}
