<?php

use App\Models\Notification;
use App\Services\UserTodoService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_todos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('notification_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedBigInteger('calendar_event_id')->nullable();
            $table->string('source_type', 32);
            $table->string('title');
            $table->text('message')->nullable();
            $table->string('action_url')->nullable();
            $table->string('system_id')->nullable();
            $table->string('category')->nullable();
            $table->string('type', 32)->default('info');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'notification_id']);
            $table->index(['user_id', 'completed_at', 'created_at']);
            $table->index('calendar_event_id');
        });

        if (! Schema::hasTable('notifications')) {
            return;
        }

        $service = app(UserTodoService::class);

        Notification::query()
            ->where('is_broadcast', false)
            ->where('is_read', false)
            ->whereNotNull('user_id')
            ->orderBy('id')
            ->each(fn (Notification $notification) => $service->createFromNotification($notification));
    }

    public function down(): void
    {
        Schema::dropIfExists('user_todos');
    }
};
