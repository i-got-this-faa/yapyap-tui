import { useCallback, useMemo, useRef, useState } from "react";

import { fetchUserById } from "../api/users";
import type { User, UserIndex } from "../types";

function indexUsers(users: readonly User[]): UserIndex {
  return users.reduce<UserIndex>((index, user) => {
    index[user.id] = user;
    return index;
  }, {});
}

export function useUsers() {
  const requestedUsers = useRef<Set<number>>(new Set());
  const [usersById, setUsersById] = useState<UserIndex>({});

  const replaceUsers = useCallback((users: readonly User[]) => {
    requestedUsers.current.clear();
    setUsersById(indexUsers(users));
  }, []);

  const mergeUsers = useCallback((users: readonly User[]) => {
    setUsersById((prev) => ({ ...prev, ...indexUsers(users) }));
  }, []);

  const upsertUser = useCallback((user: User) => {
    setUsersById((prev) => ({ ...prev, [user.id]: user }));
  }, []);

  const updateUserStatus = useCallback((userId: number, status: number) => {
    setUsersById((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] ?? { id: userId, username: `user-${userId}` }),
        status,
      },
    }));
  }, []);

  const hydrateUser = useCallback(async (userId: number, token: string) => {
    if (!userId || requestedUsers.current.has(userId)) {
      return;
    }

    requestedUsers.current.add(userId);
    const result = await fetchUserById(userId, token);

    if (result.ok) {
      setUsersById((prev) => ({ ...prev, [result.data.id]: result.data }));
    }
  }, []);

  const knownUsers = useMemo(() => {
    return Object.values(usersById).sort((left, right) => {
      const leftPriority = left.status === 1 ? 0 : 1;
      const rightPriority = right.status === 1 ? 0 : 1;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return left.username.localeCompare(right.username);
    });
  }, [usersById]);

  return {
    hydrateUser,
    knownUsers,
    mergeUsers,
    replaceUsers,
    updateUserStatus,
    upsertUser,
    usersById,
  };
}
