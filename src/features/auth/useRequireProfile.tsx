"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthContext";
import { devProfile, isDevAuthBypass } from "@/features/auth/devBypass";
import { Profile } from "@/features/profile/Models";
import { Profiles } from "@/features/profile/server/Repository";

export function useRequireProfile() {
    const [profile, setProfile] = useState<Profile | null>(isDevAuthBypass ? devProfile : null);
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (loading || isDevAuthBypass) return;

        if (!user) {
            router.push("/auth");
            return;
        }

        let isCancelled = false;

        const loadProfile = async () => {
            const loadedProfile = await Profiles.getProfileAsync(user.uid);
            if (isCancelled) return;

            if (loadedProfile) {
                setProfile(loadedProfile);
            } else {
                router.push(`/auth-error?uid=${user.uid}`);
            }
        };

        loadProfile();

        return () => {
            isCancelled = true;
        };
    }, [user, loading, router]);

    return { profile, isLoading: profile === null };
}
