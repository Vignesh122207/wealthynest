package com.wealthynest.common.entity;

/** Shared lifecycle for entities with real transaction history that must never be physically
 * deleted: ACTIVE (normal use), CLOSED (a real-world terminal event — loan paid off, position
 * fully sold, account closed at the bank; excluded from new-transaction pickers but still counted
 * in historical net worth), ARCHIVED (user-hidden, reversible). */
public enum LifecycleStatus {
    ACTIVE, CLOSED, ARCHIVED
}
