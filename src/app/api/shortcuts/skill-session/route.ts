import { NextResponse } from "next/server";
import {
  AgileMethodology,
  BookComplexity,
  BookFormat,
  DebtStrategy,
  RubikCubeType,
  RubikPenalty,
  SkillDomain,
  SpecComplianceCheckItem,
  WorkProject,
} from "@/types/rpg";
import { generateRubikScramble } from "@/lib/demo-store";
import {
  extractBookSpecsWithGemini,
  extractCubeSpecsWithGemini,
  planAgileProjectWithGemini,
} from "@/lib/gemini";
import { isSupabaseConfigured, resolvePlayerTreasury } from "@/lib/supabase";
import { requireShortcutUser, scopeIdempotencyKey } from "@/lib/request-auth";
import { persistUserCollectionsState } from "@/lib/persistence-sync";

export interface SkillSessionEndpointRequest {
  idempotency_key?: string;
  action?:
    | "log_session"
    | "set_debt_strategy"
    | "limit_break"
    | "purify_boss"
    | "redeem_wishlist"
    | "extract_cube_specs"
    | "add_cube"
    | "update_cube_notes"
    | "extract_book_specs"
    | "add_book"
    | "update_book_gallery"
    | "add_book_quote"
    | "add_knitting_project"
    | "add_work_project"
    | "generate_ai_project"
    | "add_work_project_task"
    | "move_work_project_task"
    | "complete_work_project_task"
    | "create_trial_checkpoint"
    | "new_scramble";
  checkpoint_label?: string;
  checkpoint_notes?: string;
  reset_month_cycle?: boolean;
  raw_query?: string;
  domain?: SkillDomain;
  duration_minutes?: number;
  title?: string;
  notes?: string;
  // Rubik & Cube Hardware Specs + Purchase Tracking
  cube_type?: RubikCubeType;
  cube_id?: string;
  cube_model?: string;
  cube_brand?: string;
  cube_magnetic_system?: string;
  cube_surface_finish?: string;
  cube_size_mm?: number;
  cube_weight_grams?: number;
  cube_wca_legal?: boolean;
  cube_recommended_setup?: string;
  cube_target_sub_seconds?: number;
  cube_recommended_alg_set?: string;
  cube_reward_gp_per_solve?: number;
  cube_pb_bonus_gp?: number;
  cube_status?: "active_main" | "secondary" | "retired";
  cube_price_paid?: number;
  cube_purchase_date?: string;
  cube_store_or_source?: string;
  record_purchase_in_treasury?: boolean;
  specs_compliance_checklist?: SpecComplianceCheckItem[];
  solve_time_seconds?: number;
  penalty?: RubikPenalty;
  scramble?: string;
  solves_count?: number;
  algorithm_learned?: string;
  cube_custom_notes?: string;
  cube_maintenance_needs?: string;
  // Reading & Book Specs + Gallery & Purchase Tracking
  book_id?: string;
  pages_read?: number;
  book_author?: string;
  book_total_pages?: number;
  book_category?: string;
  book_isbn?: string;
  book_language?: string;
  book_total_chapters?: number;
  book_complexity?: BookComplexity;
  book_estimated_hours?: number;
  book_recommended_daily_pages?: number;
  book_gp_per_page?: number;
  book_completion_bonus_gp?: number;
  book_xp_per_session?: number;
  book_key_learning_goal?: string;
  book_price_paid?: number;
  book_purchase_date?: string;
  book_store_or_source?: string;
  book_cover_url?: string;
  book_cover_color?: string;
  book_synopsis?: string;
  book_format?: BookFormat;
  book_rating?: number;
  book_personal_review?: string;
  book_status?: "reading" | "completed" | "wishlist";
  quote_text?: string;
  quote_page?: number;
  quotes_list?: Array<{ text: string; page?: number }>;
  reading_specs_checklist?: SpecComplianceCheckItem[];
  // Knitting
  project_id?: string;
  rows_completed?: number;
  stitches_notes?: string;
  knitting_technique?: "Crochet" | "Dos Agujas" | "Amigurumi" | "Telar";
  knitting_total_rows?: number;
  yarn_details?: string;
  // Study
  subject?: string;
  study_method?:
    | "Pomodoro 25/5"
    | "Deep Study 50/10"
    | "Active Recall"
    | "Práctica";
  // Work & Agile Projects
  deliverable?: string;
  impact_level?: "standard" | "high_impact" | "milestone";
  work_mode?: "activities" | "projects";
  work_project_name?: string;
  work_project_description?: string;
  agile_methodology?: AgileMethodology;
  agile_stage?: string;
  target_stage?: string;
  task_id?: string;
  task_title?: string;
  task_description?: string;
  task_stage?: string;
  task_priority?: "low" | "medium" | "high" | "critical";
  auto_create?: boolean;
  project_tasks?: Array<{
    title: string;
    description?: string;
    stage?: string;
    priority?: "low" | "medium" | "high" | "critical";
    estimated_minutes?: number;
  }>;
  // Debt Strategy / Limit Break / Boss Purify / Wishlist
  debt_strategy?: DebtStrategy;
  limit_break_gp?: number;
  boss_id?: string;
  amount_cop?: number;
  use_wallet_gp?: boolean;
  wishlist_item_id?: string;
}

export async function POST(req: Request) {
  try {
    const authCtx = await requireShortcutUser(req);
    if (!authCtx.ok) return authCtx.response;
    const { userId, store, db } = authCtx;

    const body = (await req.json()) as SkillSessionEndpointRequest;

    if (body.action === "new_scramble") {
      return NextResponse.json({
        success: true,
        action: "new_scramble",
        scramble: generateRubikScramble(),
      });
    }

    if (body.action === "extract_cube_specs") {
      const query = (body.raw_query || body.title || body.cube_model || "").trim();
      const cubeSpecs = await extractCubeSpecsWithGemini(query);
      return NextResponse.json({
        success: true,
        action: "extract_cube_specs",
        cube_specs: cubeSpecs,
        shortcut_tts_message: `Especificaciones extraídas para ${cubeSpecs.model_name} (${cubeSpecs.cube_type}): ${cubeSpecs.magnetic_system}, ${cubeSpecs.surface_finish}, ${cubeSpecs.weight_grams}g.`,
      });
    }

    if (body.action === "add_cube") {
      const cube = store.addRubikCube({
        model_name: body.cube_model || body.title || body.raw_query || "",
        cube_type: body.cube_type,
        brand: body.cube_brand,
        magnetic_system: body.cube_magnetic_system,
        surface_finish: body.cube_surface_finish,
        size_mm: body.cube_size_mm,
        weight_grams: body.cube_weight_grams,
        wca_legal: body.cube_wca_legal,
        recommended_setup: body.cube_recommended_setup,
        target_sub_seconds: body.cube_target_sub_seconds,
        recommended_alg_set: body.cube_recommended_alg_set,
        reward_gp_per_solve: body.cube_reward_gp_per_solve,
        pb_bonus_gp: body.cube_pb_bonus_gp,
        specs_compliance_checklist: body.specs_compliance_checklist,
        status: body.cube_status || "active_main",
        price_paid: body.cube_price_paid,
        purchase_date: body.cube_purchase_date,
        store_or_source: body.cube_store_or_source,
      });

      if (
        body.record_purchase_in_treasury &&
        cube.price_paid &&
        cube.price_paid > 0
      ) {
        store.recordTransaction({
          amount_cop: cube.price_paid,
          category: "discretionary_wishlist",
          merchant_or_concept: `Compra Cubo: ${cube.model_name} (${cube.purchase_date})`,
          use_aegis_shield: true,
        });
      }

      if (isSupabaseConfigured && db) {
        try {
          const { data: insertedCube } = await db
            .from("rubik_cubes")
            .insert({
              user_id: userId,
              cube_type: cube.cube_type,
              brand: cube.brand,
              model_name: cube.model_name,
              magnetic_system: cube.magnetic_system,
              surface_finish: cube.surface_finish,
              size_mm: cube.size_mm,
              weight_grams: cube.weight_grams,
              wca_legal: cube.wca_legal,
              recommended_setup: cube.recommended_setup,
              target_sub_seconds: cube.target_sub_seconds,
              recommended_alg_set: cube.recommended_alg_set,
              reward_gp_per_solve: cube.reward_gp_per_solve,
              pb_bonus_gp: cube.pb_bonus_gp,
              specs_compliance_checklist: cube.specs_compliance_checklist,
              status: cube.status,
            })
            .select("id")
            .maybeSingle();

          if (insertedCube?.id) {
            cube.id = String(insertedCube.id);
          }
        } catch {
          // Si la tabla rubik_cubes aún no se ha migrado en Supabase, se mantiene en memoria sin interrumpir el flujo
        }
      }

      await persistUserCollectionsState({ userId, store, db });

      return NextResponse.json(
        {
          success: true,
          action: "add_cube",
          cube,
          rubik_cubes: store.rubikCubes,
          shortcut_tts_message: `Cubo "${cube.model_name}" (${cube.cube_type}) registrado por $${(cube.price_paid || 0).toLocaleString("es-CO")} con fecha ${cube.purchase_date}.`,
        },
        { status: 201 }
      );
    }

    if (body.action === "update_cube_notes") {
      const targetId = body.cube_id || store.rubikCubes[0]?.id;
      const updated = targetId
        ? store.updateRubikCubeNotes({
            cube_id: targetId,
            custom_notes: body.cube_custom_notes ?? body.notes,
            maintenance_needs: body.cube_maintenance_needs,
            recommended_setup: body.cube_recommended_setup,
          })
        : null;

      if (isSupabaseConfigured && db && updated) {
        try {
          await db
            .from("rubik_cubes")
            .update({
              custom_notes: updated.custom_notes,
              maintenance_needs: updated.maintenance_needs,
              recommended_setup: updated.recommended_setup,
              updated_at: new Date().toISOString(),
            })
            .eq("id", updated.id)
            .eq("user_id", userId);
        } catch {
          // Si la columna aún no está en Supabase, se mantiene en memoria y sync local
        }
      }

      await persistUserCollectionsState({ userId, store, db });

      return NextResponse.json({
        success: true,
        action: "update_cube_notes",
        cube: updated,
        rubik_cubes: store.rubikCubes,
        shortcut_tts_message: `Notas del cubo actualizadas con éxito.`,
      });
    }

    if (body.action === "extract_book_specs") {
      const query = (body.raw_query || body.title || "").trim();
      const bookSpecs = await extractBookSpecsWithGemini(query);
      return NextResponse.json({
        success: true,
        action: "extract_book_specs",
        book_specs: bookSpecs,
        shortcut_tts_message: `Ficha técnica extraída para "${bookSpecs.title}" de ${bookSpecs.author}: ${bookSpecs.total_pages} páginas, meta diaria de ${bookSpecs.recommended_daily_pages} páginas y bono de ${bookSpecs.completion_bonus_gp} GP.`,
      });
    }

    if (body.action === "add_book") {
      const book = store.addReadingBook({
        title: body.title || body.raw_query || "",
        author: body.book_author,
        total_pages: body.book_total_pages,
        category: body.book_category,
        isbn: body.book_isbn,
        language: body.book_language,
        total_chapters: body.book_total_chapters,
        complexity: body.book_complexity,
        estimated_hours: body.book_estimated_hours,
        recommended_daily_pages: body.book_recommended_daily_pages,
        gp_per_page: body.book_gp_per_page,
        completion_bonus_gp: body.book_completion_bonus_gp,
        xp_per_session: body.book_xp_per_session,
        key_learning_goal: body.book_key_learning_goal,
        reading_specs_checklist: body.reading_specs_checklist,
        price_paid: body.book_price_paid,
        purchase_date: body.book_purchase_date,
        store_or_source: body.book_store_or_source,
        cover_url: body.book_cover_url,
        cover_color: body.book_cover_color,
        synopsis: body.book_synopsis,
        format: body.book_format,
        rating: body.book_rating,
        personal_review: body.book_personal_review,
        status: body.book_status,
      });

      if (
        body.record_purchase_in_treasury &&
        book.price_paid &&
        book.price_paid > 0
      ) {
        store.recordTransaction({
          amount_cop: book.price_paid,
          category: "discretionary_wishlist",
          merchant_or_concept: `Compra Libro: ${book.title} (${book.purchase_date})`,
          use_aegis_shield: true,
        });
      }

      if (isSupabaseConfigured && db) {
        try {
          const { data: richBook, error: insertRichErr } = await db
            .from("reading_books")
            .insert({
              user_id: userId,
              title: book.title,
              author: book.author,
              total_pages: book.total_pages,
              pages_read: book.pages_read,
              category: book.category,
              status: book.status === "completed" ? "completed" : "reading",
              specs_metadata: {
                isbn: book.isbn,
                language: book.language,
                total_chapters: book.total_chapters,
                complexity: book.complexity,
                estimated_hours: book.estimated_hours,
                recommended_daily_pages: book.recommended_daily_pages,
                gp_per_page: book.gp_per_page,
                completion_bonus_gp: book.completion_bonus_gp,
                xp_per_session: book.xp_per_session,
                key_learning_goal: book.key_learning_goal,
                reading_specs_checklist: book.reading_specs_checklist,
                price_paid: book.price_paid,
                purchase_date: book.purchase_date,
                store_or_source: book.store_or_source,
                cover_url: book.cover_url,
                cover_color: book.cover_color,
                synopsis: book.synopsis,
                format: book.format,
                rating: book.rating,
                personal_review: book.personal_review,
              },
            })
            .select("id")
            .maybeSingle();

          if (!insertRichErr && richBook?.id) {
            book.id = String(richBook.id);
          } else if (insertRichErr) {
            const { data: basicBook } = await db
              .from("reading_books")
              .insert({
                user_id: userId,
                title: book.title,
                author: book.author,
                total_pages: book.total_pages,
                pages_read: book.pages_read,
                category: book.category,
                status: book.status === "completed" ? "completed" : "reading",
              })
              .select("id")
              .maybeSingle();

            if (basicBook?.id) {
              book.id = String(basicBook.id);
            }
          }
        } catch {
          // Si falla la inserción remota, permanece en memoria
        }
      }

      await persistUserCollectionsState({ userId, store, db });

      return NextResponse.json(
        {
          success: true,
          action: "add_book",
          book,
          reading_books: store.readingBooks,
          shortcut_tts_message: `Libro "${book.title}" agregado a tu Galería por $${(book.price_paid || 0).toLocaleString("es-CO")} (compra: ${book.purchase_date}).`,
        },
        { status: 201 }
      );
    }

    if (body.action === "update_book_gallery" && body.book_id) {
      const updated = store.updateReadingBookGallery({
        book_id: body.book_id,
        rating: body.book_rating,
        personal_review: body.book_personal_review,
        synopsis: body.book_synopsis,
        cover_url: body.book_cover_url,
        price_paid: body.book_price_paid,
        purchase_date: body.book_purchase_date,
        store_or_source: body.book_store_or_source,
        format: body.book_format,
        status: body.book_status,
      });

      await persistUserCollectionsState({ userId, store, db });

      return NextResponse.json({
        success: true,
        action: "update_book_gallery",
        book: updated,
        reading_books: store.readingBooks,
        shortcut_tts_message: updated
          ? `Ficha de galería actualizada para "${updated.title}".`
          : "Libro no encontrado.",
      });
    }

    if (body.action === "add_book_quote") {
      const updated = store.addBookQuote({
        book_id: body.book_id || "book-1",
        text: body.quote_text || body.raw_query || "",
        page: body.quote_page,
      });

      await persistUserCollectionsState({ userId, store, db });

      return NextResponse.json({
        success: true,
        action: "add_book_quote",
        book: updated,
        reading_books: store.readingBooks,
        shortcut_tts_message: updated
          ? `Frase guardada en "${updated.title}".`
          : "No se pudo guardar la frase.",
      });
    }

    if (body.action === "create_trial_checkpoint") {
      const checkpoint = store.createTrialCheckpoint({
        label: body.checkpoint_label || body.title,
        notes: body.checkpoint_notes || body.notes,
        reset_month_cycle: Boolean(body.reset_month_cycle),
      });

      await persistUserCollectionsState({ userId, store, db });

      return NextResponse.json({
        success: true,
        action: "create_trial_checkpoint",
        checkpoint,
        trial_checkpoints: store.trialCheckpoints,
        shortcut_tts_message: body.reset_month_cycle
          ? `Corte de mes ejecutado (${store.billing_period}) y foto de bitácora "${checkpoint.label}" guardada.`
          : `Foto de bitácora "${checkpoint.label}" guardada en tu historial del periodo de prueba.`,
      });
    }

    if (body.action === "add_knitting_project") {
      const project = store.addKnittingProject({
        name: body.title || "",
        technique: body.knitting_technique || "Crochet",
        total_rows_target: body.knitting_total_rows || 50,
        yarn_details: body.yarn_details,
      });

      if (isSupabaseConfigured && db) {
        await db.from("knitting_projects").insert({
          user_id: userId,
          name: project.name,
          technique: project.technique,
          total_rows_target: project.total_rows_target,
          completed_rows: 0,
          yarn_details: project.yarn_details,
          status: "in_progress",
        });
      }

      return NextResponse.json(
        {
          success: true,
          action: "add_knitting_project",
          project,
          knitting_projects: store.knittingProjects,
          shortcut_tts_message: `Proyecto de tejido "${project.name}" (${project.technique}) creado con meta de ${project.total_rows_target} vueltas.`,
        },
        { status: 201 }
      );
    }

    if (body.action === "generate_ai_project") {
      const query = (
        body.raw_query ||
        body.work_project_name ||
        body.title ||
        ""
      ).trim();
      const aiPlan = await planAgileProjectWithGemini(query);

      let createdProject: WorkProject | undefined;
      if (body.auto_create) {
        createdProject = store.addWorkProject({
          name: aiPlan.name,
          description: aiPlan.description,
          methodology: aiPlan.methodology,
          current_stage: aiPlan.suggested_stages[0],
          tasks: aiPlan.tasks,
        });
        await persistUserCollectionsState({ userId, store, db });
      }

      return NextResponse.json({
        success: true,
        action: "generate_ai_project",
        ai_plan: aiPlan,
        project: createdProject,
        work_projects: store.workProjects,
        shortcut_tts_message: `Proyecto "${aiPlan.name}" generado con metodología ${aiPlan.methodology.toUpperCase()} y ${aiPlan.tasks.length} tarjetas en el tablero.`,
      });
    }

    if (body.action === "add_work_project") {
      const project = store.addWorkProject({
        name:
          body.work_project_name ||
          body.title ||
          body.raw_query ||
          "Nuevo Proyecto Estratégico",
        description: body.work_project_description,
        methodology: body.agile_methodology || "lean",
        current_stage: body.agile_stage,
        tasks: body.project_tasks,
      });

      await persistUserCollectionsState({ userId, store, db });

      return NextResponse.json(
        {
          success: true,
          action: "add_work_project",
          project,
          work_projects: store.workProjects,
          shortcut_tts_message: `Proyecto estratégico "${project.name}" registrado en metodología ${project.methodology.toUpperCase()} (Etapa: ${project.current_stage}).`,
        },
        { status: 201 }
      );
    }

    if (body.action === "add_work_project_task" && body.project_id) {
      const task = store.addWorkProjectTask({
        project_id: body.project_id,
        title: body.task_title || body.title || "Nueva Tarjeta",
        description: body.task_description,
        stage: body.task_stage,
        priority: body.task_priority,
        estimated_minutes: body.duration_minutes,
      });

      await persistUserCollectionsState({ userId, store, db });

      return NextResponse.json({
        success: true,
        action: "add_work_project_task",
        task,
        project: store.workProjects.find((p) => p.id === body.project_id),
        work_projects: store.workProjects,
        shortcut_tts_message: `Tarjeta "${task.title}" agregada a la columna ${task.stage}.`,
      });
    }

    if (
      body.action === "move_work_project_task" &&
      body.project_id &&
      body.task_id &&
      body.target_stage
    ) {
      const task = store.moveWorkProjectTask({
        project_id: body.project_id,
        task_id: body.task_id,
        target_stage: body.target_stage,
      });

      await persistUserCollectionsState({ userId, store, db });

      return NextResponse.json({
        success: true,
        action: "move_work_project_task",
        task,
        project: store.workProjects.find((p) => p.id === body.project_id),
        work_projects: store.workProjects,
        shortcut_tts_message: `Tarjeta "${task.title}" movida a "${task.stage}".`,
      });
    }

    if (
      body.action === "complete_work_project_task" &&
      body.project_id &&
      body.task_id
    ) {
      const compRes = store.completeWorkProjectTask({
        project_id: body.project_id,
        task_id: body.task_id,
      });

      await persistUserCollectionsState({ userId, store, db });

      return NextResponse.json({
        success: true,
        action: "complete_work_project_task",
        completed_task: compRes.task,
        project: compRes.project,
        work_projects: store.workProjects,
        reward: compRes.reward,
        wallet_gp: store.wallet_gp,
        vault_remaining_gp: store.vault_remaining_gp,
        shortcut_tts_message: `¡Tarjeta "${compRes.task.title}" completada! Liberaste ${compRes.reward.transferred_gp.toLocaleString("es-CO")} GP a tu Billetera.`,
      });
    }

    if (body.action === "set_debt_strategy" && body.debt_strategy) {
      const comparison = store.setDebtStrategy(body.debt_strategy);

      if (isSupabaseConfigured && db) {
        const treasury = await resolvePlayerTreasury(userId, db);
        if (treasury) {
          await db
            .from("player_treasury")
            .update({ debt_strategy: body.debt_strategy })
            .eq("id", treasury.id);
        }
      }

      return NextResponse.json({
        success: true,
        action: "set_debt_strategy",
        debt_strategy: store.debt_strategy,
        comparison,
        ttk_projections: store.getBossTTKProjections(),
        shortcut_tts_message: `Estrategia de combate de deuda cambiada a ${
          body.debt_strategy === "avalanche"
            ? "Avalancha (mayor tasa E.A. primero)"
            : "Bola de Nieve (menor saldo HP primero)"
        }.`,
      });
    }

    if (body.action === "limit_break") {
      const lbResult = store.triggerLimitBreak(
        body.limit_break_gp || 50000,
        body.idempotency_key
      );

      if (isSupabaseConfigured && db) {
        const treasury = await resolvePlayerTreasury(userId, db);
        if (treasury) {
          const availableGp =
            Number(treasury.wallet_gp) + Number(treasury.vault_remaining_gp);
          const sacrifice = Math.min(
            Math.max(10000, Math.round(body.limit_break_gp || 50000)),
            Math.max(0, availableGp)
          );
          if (sacrifice > 0) {
            const fromWallet = Math.min(
              Math.max(0, Number(treasury.wallet_gp)),
              sacrifice
            );
            const fromVault = sacrifice - fromWallet;
            const bonusXp = Math.round(sacrifice / 250);
            const newXp = Number(treasury.current_xp) + bonusXp;
            const newLevel = Math.max(
              1,
              Math.floor(Math.sqrt(newXp / 100)) + 1
            );

            await db
              .from("player_treasury")
              .update({
                wallet_gp: Number(treasury.wallet_gp) - fromWallet,
                vault_remaining_gp: Math.max(
                  0,
                  Number(treasury.vault_remaining_gp) - fromVault
                ),
                current_xp: newXp,
                player_level: newLevel,
                updated_at: new Date().toISOString(),
              })
              .eq("id", treasury.id);

            await db.from("financial_transactions").insert({
              user_id: userId,
              treasury_id: treasury.id,
              amount_cop: sacrifice,
              category: "debt_attack",
              merchant_or_concept: `⚡ LIMIT BREAK: Sacrificio de Bóveda/Billetera`,
              aegis_shield_used: false,
              idempotency_key: scopeIdempotencyKey(userId, body.idempotency_key),
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        action: "limit_break",
        limit_break_result: lbResult,
        treasury_snapshot: {
          wallet_gp: store.wallet_gp,
          vault_remaining_gp: store.vault_remaining_gp,
          player_level: store.player_level,
          current_xp: store.current_xp,
        },
        shortcut_tts_message: `¡Limit Break ejecutado! Sacrificaste ${lbResult.sacrificed_gp.toLocaleString("es-CO")} GP para impactar directamente a tus Debt Bosses y ganaste ${lbResult.bonus_xp} XP extra.`,
      });
    }

    if (body.action === "purify_boss" && body.boss_id) {
      const purifyRes = store.applyPurificationPotion({
        boss_id: body.boss_id,
        amount_cop: body.amount_cop,
        use_wallet_gp: body.use_wallet_gp,
      });

      if (isSupabaseConfigured && db) {
        const treasury = await resolvePlayerTreasury(userId, db);
        if (treasury) {
          if (body.use_wallet_gp) {
            await db
              .from("player_treasury")
              .update({
                wallet_gp: store.wallet_gp,
                updated_at: new Date().toISOString(),
              })
              .eq("id", treasury.id);
          }
          await db
            .from("debt_bosses")
            .update({
              current_hp: purifyRes.boss.current_hp,
              paid_this_month_cop: purifyRes.boss.paid_this_month_cop,
              status: purifyRes.boss.status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", body.boss_id);

          await db.from("financial_transactions").insert({
            user_id: userId,
            treasury_id: treasury.id,
            amount_cop: purifyRes.damage_dealt_cop,
            category: "debt_attack",
            merchant_or_concept: `🧪 Poción de Purificación: ${purifyRes.boss.name}`,
            boss_id: purifyRes.boss.id,
            aegis_shield_used: false,
            idempotency_key: scopeIdempotencyKey(userId, body.idempotency_key),
          });
        }
      }

      await persistUserCollectionsState({ userId, store, db });

      return NextResponse.json({
        success: true,
        action: "purify_boss",
        purify_result: purifyRes,
        bosses: store.bosses,
        ttk_projections: store.getBossTTKProjections(),
        wallet_gp: store.wallet_gp,
        shortcut_tts_message: purifyRes.message,
      });
    }

    if (body.action === "redeem_wishlist" && body.wishlist_item_id) {
      const txRes = store.recordTransaction({
        amount_cop: 0,
        category: "discretionary_wishlist",
        merchant_or_concept: "Canje de Deseo Wishlist",
        wishlist_item_id: body.wishlist_item_id,
        idempotency_key: body.idempotency_key,
      });

      if (isSupabaseConfigured && db) {
        const treasury = await resolvePlayerTreasury(userId, db);
        if (treasury) {
          await db
            .from("player_treasury")
            .update({
              wallet_gp: store.wallet_gp,
              updated_at: new Date().toISOString(),
            })
            .eq("id", treasury.id);

          await db
            .from("wishlist_items")
            .update({
              is_redeemed: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", body.wishlist_item_id);
        }
      }

      await persistUserCollectionsState({ userId, store, db });

      return NextResponse.json({
        success: true,
        action: "redeem_wishlist",
        transaction: txRes,
        wishlist: store.getDecoratedWishlist(),
        wallet_gp: store.wallet_gp,
        shortcut_tts_message: `¡Deseo canjeado con éxito! Se descontaron ${txRes.wallet_gp_deducted.toLocaleString("es-CO")} GP de tu Billetera.`,
      });
    }

    const domain = body.domain || "study";
    const result = store.logSkillSession({
      domain,
      duration_minutes: body.duration_minutes || 25,
      title: body.title,
      notes: body.notes,
      idempotency_key: body.idempotency_key,
      cube_type: body.cube_type,
      cube_id: body.cube_id,
      cube_model: body.cube_model,
      solve_time_seconds: body.solve_time_seconds,
      penalty: body.penalty,
      scramble: body.scramble,
      solves_count: body.solves_count,
      algorithm_learned: body.algorithm_learned,
      book_id: body.book_id,
      pages_read: body.pages_read,
      quote_text: body.quote_text,
      quote_page: body.quote_page,
      quotes_list: body.quotes_list,
      project_id: body.project_id,
      rows_completed: body.rows_completed,
      stitches_notes: body.stitches_notes,
      subject: body.subject,
      study_method: body.study_method,
      deliverable: body.deliverable,
      impact_level: body.impact_level,
      work_mode: body.work_mode,
      agile_methodology: body.agile_methodology,
      agile_stage: body.agile_stage,
    });

    if (isSupabaseConfigured && db) {
      const treasury = await resolvePlayerTreasury(userId, db);

      if (treasury) {
        await db.from("activity_logs").insert({
          user_id: userId,
          treasury_id: treasury.id,
          domain,
          activity_name: result.session.title,
          duration_minutes: result.session.duration_minutes,
          requested_gp: result.session.gp_earned,
          earned_xp: result.session.xp_earned,
          session_metadata: result.session.metadata || {},
          notes: body.notes || result.session.details,
          idempotency_key: scopeIdempotencyKey(userId, body.idempotency_key),
        });
      }

      if (
        domain === "rubik" &&
        result.rubik_stats &&
        result.rubik_stats.recent_solves[0]
      ) {
        const latestSolve = result.rubik_stats.recent_solves[0];
        const { error: solveRichErr } = await db
          .from("rubik_solves")
          .insert({
            user_id: userId,
            cube_type: latestSolve.cube_type,
            cube_model: latestSolve.cube_model || null,
            time_seconds: latestSolve.time_seconds,
            penalty: latestSolve.penalty || "NONE",
            scramble: latestSolve.scramble,
            is_pb: latestSolve.is_pb,
            ao5_after: latestSolve.ao5_after,
            ao12_after: latestSolve.ao12_after,
            algorithm_practiced: latestSolve.algorithm_practiced || null,
          });
        if (solveRichErr) {
          await db.from("rubik_solves").insert({
            user_id: userId,
            cube_type: latestSolve.cube_type,
            time_seconds: latestSolve.time_seconds,
            penalty: latestSolve.penalty || "NONE",
            scramble: latestSolve.scramble,
            is_pb: latestSolve.is_pb,
            ao5_after: latestSolve.ao5_after,
            ao12_after: latestSolve.ao12_after,
            algorithm_practiced: latestSolve.algorithm_practiced || null,
          });
        }
      } else if (domain === "reading" && body.pages_read) {
        const pagesDelta = Math.max(1, body.pages_read);
        let targetBookQuery = db
          .from("reading_books")
          .select("*")
          .eq("user_id", userId);

        if (body.book_id && !body.book_id.startsWith("book-")) {
          targetBookQuery = targetBookQuery.eq("id", body.book_id);
        } else {
          targetBookQuery = targetBookQuery
            .order("created_at", { ascending: true })
            .limit(1);
        }

        const { data: sbBook } = await targetBookQuery.maybeSingle();
        if (sbBook) {
          const newPagesRead = Math.min(
            Number(sbBook.total_pages),
            Number(sbBook.pages_read) + pagesDelta
          );
          await db
            .from("reading_books")
            .update({
              pages_read: newPagesRead,
              status:
                newPagesRead >= Number(sbBook.total_pages)
                  ? "completed"
                  : "reading",
              updated_at: new Date().toISOString(),
            })
            .eq("id", sbBook.id);
        }
      } else if (domain === "knitting" && body.rows_completed) {
        const rowsDelta = Math.max(1, body.rows_completed);
        let targetProjQuery = db
          .from("knitting_projects")
          .select("*")
          .eq("user_id", userId);

        if (body.project_id && !body.project_id.startsWith("knit-")) {
          targetProjQuery = targetProjQuery.eq("id", body.project_id);
        } else {
          targetProjQuery = targetProjQuery
            .order("created_at", { ascending: true })
            .limit(1);
        }

        const { data: sbProj } = await targetProjQuery.maybeSingle();
        if (sbProj) {
          const newCompletedRows = Math.min(
            Number(sbProj.total_rows_target),
            Number(sbProj.completed_rows) + rowsDelta
          );
          await db
            .from("knitting_projects")
            .update({
              completed_rows: newCompletedRows,
              status:
                newCompletedRows >= Number(sbProj.total_rows_target)
                  ? "completed"
                  : "in_progress",
              updated_at: new Date().toISOString(),
            })
            .eq("id", sbProj.id);
        }
      }
    }

    await persistUserCollectionsState({ userId, store, db });

    return NextResponse.json(
      {
        success: true,
        mode: isSupabaseConfigured ? "supabase" : "local_engine",
        session_logged: result.session,
        reward_impact: result.reward_impact,
        rubik_stats: result.rubik_stats,
        work_projects: store.workProjects,
        skill_summaries: store.getSkillDomainSummaries(),
        treasury_snapshot: {
          wallet_gp: store.wallet_gp,
          vault_remaining_gp: store.vault_remaining_gp,
          player_level: store.player_level,
          current_xp: store.current_xp,
          current_streak_days: store.current_streak_days,
          streak_multiplier: store.streak_multiplier,
          aegis_shields: store.aegis_shields,
        },
        shortcut_tts_message: `¡Sesión de ${domain.toUpperCase()} registrada! ${
          result.session.title
        }. Liberaste ${result.reward_impact.transferred_gp.toLocaleString(
          "es-CO"
        )} GP a tu Billetera con multiplicador ${
          result.reward_impact.streak_multiplier_applied
        }x.`,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
