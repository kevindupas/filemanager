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
        Schema::create('trashed_items', function (Blueprint $table) {
            $table->id();
            $table->string('original_path');          // where it lived (relative to local root)
            $table->string('name');
            $table->string('type');                   // file | dir
            $table->unsignedBigInteger('size')->nullable();
            $table->string('storage_key')->unique();  // location inside the trash disk
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();                     // created_at = trashed-at
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trashed_items');
    }
};
