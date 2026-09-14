import Knex from 'knex';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'photobooth.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

interface SqliteConnection {
  run: (sql: string, callback: (err: Error | null) => void) => void;
}

const knex = Knex({
  client: 'sqlite3',
  connection: { filename: DB_PATH },
  useNullAsDefault: true,
  pool: {
    afterCreate: (conn: SqliteConnection, cb: (err: Error | null) => void) => {
      conn.run('PRAGMA journal_mode=WAL', cb);
    },
  },
});

export async function initDb(): Promise<void> {
  // Rooms
  if (!(await knex.schema.hasTable('rooms'))) {
    await knex.schema.createTable('rooms', (t) => {
      t.string('id').primary();
      t.string('code').unique().notNullable();
      t.string('status').notNullable().defaultTo('lobby');
      t.integer('capacity').notNullable().defaultTo(2);
      t.text('settings_json').notNullable().defaultTo('{}');
      t.integer('current_round_index').notNullable().defaultTo(0);
      t.string('current_round_status').notNullable().defaultTo('waiting_ready');
      t.bigInteger('created_at').notNullable();
      t.bigInteger('expires_at').notNullable();
      t.bigInteger('completed_at').nullable();
      t.string('pin', 8).nullable();
    });
  } else {
    // Migration: ensure pin column exists on existing databases
    if (!(await knex.schema.hasColumn('rooms', 'pin'))) {
      await knex.schema.table('rooms', (t) => {
        t.string('pin', 8).nullable();
      });
    }
  }

  // Participants
  if (!(await knex.schema.hasTable('participants'))) {
    await knex.schema.createTable('participants', (t) => {
      t.string('id').primary();
      t.string('room_id').notNullable().references('id').inTable('rooms').onDelete('CASCADE');
      t.string('display_name').notNullable();
      t.string('session_token').notNullable();
      t.integer('is_host').notNullable().defaultTo(0);
      t.string('side').notNullable().defaultTo('left');
      t.string('connection_status').notNullable().defaultTo('connected');
      t.string('socket_id').nullable();
      t.bigInteger('joined_at').notNullable();
    });
  }

  // Photos
  if (!(await knex.schema.hasTable('photos'))) {
    await knex.schema.createTable('photos', (t) => {
      t.string('id').primary();
      t.string('room_id').notNullable().references('id').inTable('rooms').onDelete('CASCADE');
      t.string('participant_id').notNullable();
      t.string('side').notNullable();
      t.integer('slot_index').notNullable();
      t.string('storage_key').notNullable();
      t.text('filters_json').notNullable().defaultTo('[]');
      t.bigInteger('captured_at').notNullable();
      t.text('kept_by_json').notNullable().defaultTo('[]');
    });
  }

  // Frame templates
  if (!(await knex.schema.hasTable('frame_templates'))) {
    await knex.schema.createTable('frame_templates', (t) => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.string('layout_type').notNullable();
      t.text('description').nullable();
      t.string('accent_color').notNullable().defaultTo('#ff6b9d');
      t.string('thumbnail_gradient').notNullable();
      t.string('overlay_key').nullable();
      t.text('cutout_boxes_json').nullable();
      t.integer('frame_width').nullable();
      t.integer('frame_height').nullable();
      t.string('category').nullable();
      t.integer('is_custom').notNullable().defaultTo(0);
      t.bigInteger('created_at').nullable();
    });

    // Seed templates
    const defaultTemplates = [
      { id: 'duo_strips_4', name: 'Duo Twin Strips (4-Cut)', layout_type: 'duo_strips_4', description: 'Two separate vertical photostrips side-by-side — one for each person', accent_color: '#ff5e97', thumbnail_gradient: 'linear-gradient(135deg, #f093fb, #f5576c)' },
      { id: 'duo_strips_3', name: 'Duo Trio Strips (3-Cut)', layout_type: 'duo_strips_3', description: 'Two separate 3-cut vertical strips with larger photo frames', accent_color: '#a78bfa', thumbnail_gradient: 'linear-gradient(135deg, #a78bfa, #818cf8)' },
      { id: 'side_by_side_grid', name: 'Dual Moments Grid', layout_type: 'side_by_side_grid', description: 'Separate side-by-side framed photo cards in an aesthetic gallery layout', accent_color: '#38bdf8', thumbnail_gradient: 'linear-gradient(135deg, #38bdf8, #0ea5e9)' },
      { id: 'polaroid_duo', name: 'Polaroid Memories', layout_type: 'polaroid_duo', description: 'Aesthetic polaroid cards with white borders & personalized footer', accent_color: '#f59e0b', thumbnail_gradient: 'linear-gradient(135deg, #fbbf24, #f59e0b)' },
      { id: 'vintage_film', name: 'Vintage 35mm Film', layout_type: 'vintage_film', description: 'Retro cinema filmstrip with separate individual photo frames', accent_color: '#10b981', thumbnail_gradient: 'linear-gradient(135deg, #34d399, #059669)' },
      { id: 'minimal_chic', name: 'Modern Studio', layout_type: 'minimal_chic', description: 'High-end studio frames with minimalist typography and elegant borders', accent_color: '#ffffff', thumbnail_gradient: 'linear-gradient(135deg, #64748b, #1e293b)' },
    ];

    for (const t of defaultTemplates) {
      const exists = await knex('frame_templates').where('id', t.id).first();
      if (!exists) {
        await knex('frame_templates').insert(t);
      }
    }
  }

  // Migration: ensure custom frame columns exist if table already exists without them
  if (await knex.schema.hasTable('frame_templates')) {
    if (!(await knex.schema.hasColumn('frame_templates', 'is_custom'))) {
      await knex.schema.table('frame_templates', (t) => {
        t.string('overlay_key').nullable();
        t.text('cutout_boxes_json').nullable();
        t.integer('frame_width').nullable();
        t.integer('frame_height').nullable();
        t.string('category').nullable();
        t.integer('is_custom').notNullable().defaultTo(0);
        t.bigInteger('created_at').nullable();
      });
    }
  }

  // Votes
  if (!(await knex.schema.hasTable('votes'))) {
    await knex.schema.createTable('votes', (t) => {
      t.string('id').primary();
      t.string('room_id').notNullable().references('id').inTable('rooms').onDelete('CASCADE');
      t.string('participant_id').notNullable();
      t.string('frame_template_id').notNullable();
      t.text('customization_json').notNullable().defaultTo('{}');
      t.bigInteger('voted_at').notNullable();
      t.unique(['room_id', 'participant_id']);
    });
  }

  // Final renders
  if (!(await knex.schema.hasTable('final_renders'))) {
    await knex.schema.createTable('final_renders', (t) => {
      t.string('id').primary();
      t.string('room_id').notNullable().references('id').inTable('rooms').onDelete('CASCADE');
      t.string('frame_template_id').notNullable();
      t.string('output_key').notNullable();
      t.bigInteger('rendered_at').notNullable();
    });
  }

  // Global Community Custom Backgrounds (Shared for all users, never deleted across rounds)
  if (!(await knex.schema.hasTable('custom_backgrounds'))) {
    await knex.schema.createTable('custom_backgrounds', (t) => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.string('storage_key').notNullable();
      t.string('uploaded_by').notNullable().defaultTo('Komunitas');
      t.string('uploaded_by_id').nullable();
      t.bigInteger('created_at').notNullable();
    });
  }
}

export default knex;
