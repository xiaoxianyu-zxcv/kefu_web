// stores/errorStore.ts
import { defineStore } from 'pinia'
import {ErrorMessage} from "../types/error";

export const useErrorStore = defineStore('error', {
    state: () => ({
        errors: [] as ErrorMessage[],
        isRecovering: false,
        lastError: null as ErrorMessage | null,
    }),

    actions: {
        addError(error: ErrorMessage) {
            this.errors.push(error);
            this.lastError = error;
        },

        clearErrors() {
            this.errors = [];
            this.lastError = null;
        },

        setRecovering(status: boolean) {
            this.isRecovering = status;
        }
    },

    getters: {
        hasErrors: (state) => state.errors.length > 0,
        getErrorsByType: (state) => (type: string) =>
            state.errors.filter(e => e.code.startsWith(type))
    }
})