<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-file comments. A comment targets a file by (owner_id, path); visible to
 * the owner and to anyone with a grant covering that path.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('file_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('author_id')->constrained('users')->cascadeOnDelete();
            $table->string('path');
            $table->text('body');
            $table->timestamps();

            $table->index(['owner_id', 'path']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('file_comments');
    }
};
