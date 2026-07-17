<?php

namespace Database\Seeders;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class ConversationMessageSeeder extends Seeder
{
    private const ADMIN_EMAIL = 'mus.shafiq@emzi.com.my';

    /**
     * @return array<int, array{
     *   name: string,
     *   full_name: string,
     *   email: string,
     *   job_title: string,
     *   messages: array<int, array{from: 'admin'|'peer', body: string, minutes_ago: int}>
     * }>
     */
    private function threads(): array
    {
        return [
            [
                'name' => 'Sarah Chen',
                'full_name' => 'Sarah Chen',
                'email' => 'sarah.chen@emzi.com',
                'job_title' => 'Project Manager',
                'messages' => [
                    ['from' => 'peer', 'body' => 'Hi Admin — can we push the Bangsar South site walkthrough to Thursday morning? The contractor said Wednesday is fully booked.', 'minutes_ago' => 420],
                    ['from' => 'admin', 'body' => 'Thursday works. Can you lock in 10am and send the agenda to the client by EOD?', 'minutes_ago' => 390],
                    ['from' => 'peer', 'body' => 'Done. Agenda draft is in the shared folder. Also need your sign-off on the contingency budget line before I send it.', 'minutes_ago' => 360],
                    ['from' => 'admin', 'body' => 'Reviewed — approved with a 5% contingency cap. Please note that in the email.', 'minutes_ago' => 330],
                    ['from' => 'peer', 'body' => 'Noted, sending now. Thanks!', 'minutes_ago' => 300],
                    ['from' => 'peer', 'body' => 'Quick update: client confirmed Thursday 10am. I\'ll brief the ops team tomorrow.', 'minutes_ago' => 45],
                ],
            ],
            [
                'name' => 'Marcus Wong',
                'full_name' => 'Marcus Wong',
                'email' => 'marcus.wong@emzi.com',
                'job_title' => 'Finance Lead',
                'messages' => [
                    ['from' => 'admin', 'body' => 'Marcus — can you pull the Q2 expense summary for the board pack? Need it by Friday.', 'minutes_ago' => 1440],
                    ['from' => 'peer', 'body' => 'On it. Do you want the breakdown by department or by project?', 'minutes_ago' => 1410],
                    ['from' => 'admin', 'body' => 'Both if possible — department on the first tab, project on the second. Highlight anything over budget.', 'minutes_ago' => 1380],
                    ['from' => 'peer', 'body' => 'Spreadsheet is ready in Finance > Board Pack. Facilities and Marketing are the only two over by more than 8%.', 'minutes_ago' => 180],
                    ['from' => 'admin', 'body' => 'Perfect, I\'ll review this afternoon. Can you also flag the unpaid vendor invoices over 30 days?', 'minutes_ago' => 150],
                    ['from' => 'peer', 'body' => 'Added a third tab for aging payables. Three vendors are past 45 days — I flagged them in red.', 'minutes_ago' => 90],
                ],
            ],
            [
                'name' => 'Priya Nair',
                'full_name' => 'Priya Nair',
                'email' => 'priya.nair@emzi.com',
                'job_title' => 'HR Manager',
                'messages' => [
                    ['from' => 'peer', 'body' => 'Admin, the onboarding checklist for the new property associates is ready for review. Want me to walk you through it?', 'minutes_ago' => 2880],
                    ['from' => 'admin', 'body' => 'Yes — send the doc over and we can sync for 15 mins after lunch.', 'minutes_ago' => 2850],
                    ['from' => 'peer', 'body' => 'Shared via email. Also: two leave requests from Ops are pending your approval in the portal.', 'minutes_ago' => 2820],
                    ['from' => 'admin', 'body' => 'Approved both. Checklist looks good — just add a line for access card handover and we\'re set.', 'minutes_ago' => 2700],
                    ['from' => 'peer', 'body' => 'Updated. I\'ll start scheduling orientation for next Monday\'s joiners.', 'minutes_ago' => 2640],
                    ['from' => 'peer', 'body' => 'Reminder: performance review kickoff is next week. Need the final rating rubric from you by Wednesday.', 'minutes_ago' => 120],
                ],
            ],
            [
                'name' => 'Daniel Lim',
                'full_name' => 'Daniel Lim',
                'email' => 'daniel.lim@emzi.com',
                'job_title' => 'IT Support',
                'messages' => [
                    ['from' => 'peer', 'body' => 'Heads up — VPN cert renewals go out Friday. Anyone still on the old client will get kicked after that.', 'minutes_ago' => 720],
                    ['from' => 'admin', 'body' => 'Thanks. Can you send a company-wide notice and include the install steps for macOS?', 'minutes_ago' => 690],
                    ['from' => 'peer', 'body' => 'Draft is ready. Also fixed the printer queue at SP Plaza — it was stuck on an old job from Facilities.', 'minutes_ago' => 660],
                    ['from' => 'admin', 'body' => 'Appreciate that. One more thing: can you provision a laptop for the new hire starting Monday?', 'minutes_ago' => 630],
                    ['from' => 'peer', 'body' => 'Already imaging one. Will leave it with HR on Friday with the setup sheet.', 'minutes_ago' => 600],
                    ['from' => 'admin', 'body' => 'Great. Let me know if anything blocks the VPN rollout.', 'minutes_ago' => 570],
                    ['from' => 'peer', 'body' => 'All set — notice sent. 12 people have confirmed they upgraded already.', 'minutes_ago' => 30],
                ],
            ],
            [
                'name' => 'Aisha Rahman',
                'full_name' => 'Aisha Rahman',
                'email' => 'aisha.rahman@emzi.com',
                'job_title' => 'Operations Coordinator',
                'messages' => [
                    ['from' => 'admin', 'body' => 'Aisha, how\'s the weekend cleaning roster looking for the KL properties?', 'minutes_ago' => 960],
                    ['from' => 'peer', 'body' => 'Mostly covered. Still short one cleaner for Mont Kiara Block B on Saturday morning.', 'minutes_ago' => 930],
                    ['from' => 'admin', 'body' => 'Can we pull someone from the Bangsar team, or do we need a temp?', 'minutes_ago' => 900],
                    ['from' => 'peer', 'body' => 'Bangsar can spare one. I\'ve moved Farid over and updated the roster sheet.', 'minutes_ago' => 840],
                    ['from' => 'admin', 'body' => 'Perfect. Please confirm with the building manager so they know who to expect.', 'minutes_ago' => 810],
                    ['from' => 'peer', 'body' => 'Confirmed. Building manager has Farid\'s name and contact. Roster is locked for the weekend.', 'minutes_ago' => 60],
                ],
            ],
            [
                'name' => 'Jason Tan',
                'full_name' => 'Jason Tan',
                'email' => 'jason.tan@emzi.com',
                'job_title' => 'Sales Executive',
                'messages' => [
                    ['from' => 'peer', 'body' => 'Got a warm lead on a 3-bedroom unit at SP Residences. Tenant wants a viewing this Saturday.', 'minutes_ago' => 480],
                    ['from' => 'admin', 'body' => 'Nice. Is Unit 12-08 still available, or are they looking at the vacant 15-03?', 'minutes_ago' => 450],
                    ['from' => 'peer', 'body' => '15-03 — they need the bigger balcony. Asking if we can do RM4,200 instead of RM4,500.', 'minutes_ago' => 420],
                    ['from' => 'admin', 'body' => 'We can meet at RM4,350 if they sign a 2-year lease. Don\'t go below that without checking with me.', 'minutes_ago' => 390],
                    ['from' => 'peer', 'body' => 'Understood. I\'ll pitch the 2-year option at the viewing. Will update you after.', 'minutes_ago' => 360],
                    ['from' => 'peer', 'body' => 'Update: they\'re keen on RM4,350 / 2 years. Sending the offer letter for your review shortly.', 'minutes_ago' => 20],
                ],
            ],
            [
                'name' => 'Emily Chong',
                'full_name' => 'Emily Chong',
                'email' => 'emily.chong@emzi.com',
                'job_title' => 'Marketing Specialist',
                'messages' => [
                    ['from' => 'admin', 'body' => 'Emily — can you draft the LinkedIn post for the new Mont Kiara listing? Photos are in the Drive folder.', 'minutes_ago' => 2160],
                    ['from' => 'peer', 'body' => 'Drafted. Want me to keep the tone more lifestyle-focused or more specs-heavy?', 'minutes_ago' => 2100],
                    ['from' => 'admin', 'body' => 'Lifestyle first, specs in the second half. Mention the co-working lounge — that\'s a strong selling point.', 'minutes_ago' => 2070],
                    ['from' => 'peer', 'body' => 'Updated draft is ready. Also prepared Instagram stories with the floor plan carousel.', 'minutes_ago' => 1980],
                    ['from' => 'admin', 'body' => 'Looks good — schedule LinkedIn for Tuesday 10am and IG stories for Wednesday evening.', 'minutes_ago' => 1920],
                    ['from' => 'peer', 'body' => 'Scheduled. I\'ll send engagement numbers by end of week so we can decide on a boost budget.', 'minutes_ago' => 1860],
                    ['from' => 'peer', 'body' => 'Early numbers: LinkedIn post got 1.2k impressions in the first day. Want me to boost it?', 'minutes_ago' => 15],
                ],
            ],
        ];
    }

    public function run(): void
    {
        $admin = User::query()
            ->where('email', self::ADMIN_EMAIL)
            ->where('is_approved', true)
            ->first();

        if (! $admin) {
            $this->command?->warn('Admin user ['.self::ADMIN_EMAIL.'] not found. Skipping conversation seed.');

            return;
        }

        $seeded = 0;

        foreach ($this->threads() as $thread) {
            $peer = User::query()->updateOrCreate(
                ['email' => $thread['email']],
                [
                    'name' => $thread['name'],
                    'full_name' => $thread['full_name'],
                    'job_title' => $thread['job_title'],
                    'password' => Hash::make('password'),
                    'role' => 'user',
                    'is_approved' => true,
                    'email_verified_at' => now(),
                ]
            );

            $this->purgeExistingConversation($admin, $peer);

            $messages = $thread['messages'];
            $lastAt = Carbon::now()->subMinutes($messages[array_key_last($messages)]['minutes_ago']);

            DB::transaction(function () use ($admin, $peer, $messages, $lastAt, &$seeded) {
                $conversation = Conversation::create([
                    'type' => 'direct',
                    'last_message_at' => $lastAt,
                ]);

                $conversation->participants()->attach([
                    $admin->id => ['last_read_at' => Carbon::now()->subMinutes(200)],
                    $peer->id => ['last_read_at' => Carbon::now()],
                ]);

                foreach ($messages as $message) {
                    $createdAt = Carbon::now()->subMinutes($message['minutes_ago']);
                    $senderId = $message['from'] === 'admin' ? $admin->id : $peer->id;

                    Message::query()->create([
                        'conversation_id' => $conversation->id,
                        'sender_user_id' => $senderId,
                        'body' => $message['body'],
                        'created_at' => $createdAt,
                        'updated_at' => $createdAt,
                    ]);

                    $seeded++;
                }
            });
        }

        $this->command?->info(sprintf(
            'Seeded %d messages across %d conversations for %s.',
            $seeded,
            count($this->threads()),
            self::ADMIN_EMAIL,
        ));
    }

    private function purgeExistingConversation(User $admin, User $peer): void
    {
        $conversationIds = Conversation::query()
            ->where('type', 'direct')
            ->whereHas('participants', fn ($q) => $q->where('users.id', $admin->id))
            ->whereHas('participants', fn ($q) => $q->where('users.id', $peer->id))
            ->pluck('id');

        if ($conversationIds->isEmpty()) {
            return;
        }

        Message::query()->whereIn('conversation_id', $conversationIds)->delete();
        DB::table('conversation_participants')->whereIn('conversation_id', $conversationIds)->delete();
        Conversation::query()->whereIn('id', $conversationIds)->delete();
    }
}
