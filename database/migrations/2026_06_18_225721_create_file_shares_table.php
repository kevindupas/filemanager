<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('file_shares', function (Blueprint $table) {
            $table->id();
            $table->string('token', 64)->unique();
            $table->string('path');                   // shared file, relative to local root
            $table->string('name');
            $table->string('password')->nullable();   // hashed, optional
            $table->timestamp('expires_at')->nullable();
            $table->unsignedBigInteger('downloads')->default(0);
            $table->timestamp('last_accessed_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('file_shares');
    }
};
