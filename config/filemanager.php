<?php

return [
    /*
    | Soft storage quota for the `local` disk, in gigabytes. Shown on the
    | dashboard and enforced on upload. Set to 0 to disable the limit.
    */
    'quota_gb' => (float) env('FILEMANAGER_QUOTA_GB', 50),
];
