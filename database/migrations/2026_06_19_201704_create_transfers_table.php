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
        Schema::create('transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('mode'); // move | copy
            $table->string('source_disk');
            $table->string('dest_disk');
            $table->string('destination')->default('');
            $table->json('paths');
            $table->string('status')->default('queued'); // queued | running | done | failed
            $table->unsignedBigInteger('total_bytes')->default(0);
            $table->unsignedBigInteger('done_bytes')->default(0);
            $table->unsignedInteger('total_files')->default(0);
            $table->unsignedInteger('done_files')->default(0);
            $table->string('current')->nullable();
            $table->text('error')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transfers');
    }
};
