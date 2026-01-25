import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import type { User } from '../types/auth';

const fetchUser = async (): Promise<User | null> => {
    try {
        const { data } = await apiClient.get('/api/auth/me');
        return data;
    } catch {
        return null;
    }
};

const logoutUser = async () => {
    await apiClient.post('/api/auth/logout');
};



export function useAuth() {
    const queryClient = useQueryClient();

    const { data: user, isLoading, error } = useQuery({
        queryKey: ['auth', 'user'],
        queryFn: fetchUser,
        retry: false,
    });

    const logoutMutation = useMutation({
        mutationFn: logoutUser,
        onSuccess: () => {
            queryClient.setQueryData(['auth', 'user'], null);
        },
    });

    return {
        user,
        isLoading,
        error,
        logout: logoutMutation.mutate,
    };
}
