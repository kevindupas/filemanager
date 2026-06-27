<?php

return [
    /*
    | Soft storage quota for the `local` disk, in gigabytes. Shown on the
    | dashboard and enforced on upload. Set to 0 to disable the limit.
    */
    'quota_gb' => (float) env('FILEMANAGER_QUOTA_GB', 50),

    /*
    | How many previous versions to keep per file (older ones are pruned).
    | Versions live under the user's hidden .versions/ area and count toward
    | the storage quota.
    */
    'max_versions' => (int) env('FILEMANAGER_MAX_VERSIONS', 20),

    /*
    | Auto-purge trashed items older than this many days. 0 = keep forever.
    | Enforced by the scheduled `trash:purge` command; overridable at runtime
    | via the `trash_retention_days` setting.
    */
    'trash_retention_days' => (int) env('FILEMANAGER_TRASH_RETENTION_DAYS', 30),
];
