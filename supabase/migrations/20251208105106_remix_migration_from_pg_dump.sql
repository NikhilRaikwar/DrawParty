CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: cleanup_old_rooms(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_rooms() RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.rooms WHERE updated_at < now() - interval '24 hours';
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: room_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid NOT NULL,
    player_id text NOT NULL,
    player_name text NOT NULL,
    content text NOT NULL,
    is_correct_guess boolean DEFAULT false NOT NULL,
    is_system_message boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: room_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid NOT NULL,
    player_id text NOT NULL,
    player_name text NOT NULL,
    avatar text NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    is_host boolean DEFAULT false NOT NULL,
    is_ready boolean DEFAULT false NOT NULL,
    is_muted boolean DEFAULT false NOT NULL,
    is_connected boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    host_id text NOT NULL,
    settings jsonb DEFAULT '{"drawTime": 80, "gameMode": "normal", "isPublic": true, "hintLevel": 2, "maxPlayers": 8, "totalRounds": 3}'::jsonb NOT NULL,
    game_state jsonb DEFAULT '{"phase": "lobby", "players": [], "drawTime": 80, "messages": [], "wordHint": "", "currentWord": null, "totalRounds": 3, "currentRound": 0, "timeRemaining": 80, "correctGuessers": [], "currentDrawerId": null}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: room_messages room_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_messages
    ADD CONSTRAINT room_messages_pkey PRIMARY KEY (id);


--
-- Name: room_players room_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_players
    ADD CONSTRAINT room_players_pkey PRIMARY KEY (id);


--
-- Name: room_players room_players_room_id_player_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_players
    ADD CONSTRAINT room_players_room_id_player_id_key UNIQUE (room_id, player_id);


--
-- Name: rooms rooms_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_code_key UNIQUE (code);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: rooms update_rooms_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: room_messages room_messages_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_messages
    ADD CONSTRAINT room_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: room_players room_players_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_players
    ADD CONSTRAINT room_players_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: room_messages Allow public delete access to room_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete access to room_messages" ON public.room_messages FOR DELETE USING (true);


--
-- Name: room_players Allow public delete access to room_players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete access to room_players" ON public.room_players FOR DELETE USING (true);


--
-- Name: rooms Allow public delete access to rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete access to rooms" ON public.rooms FOR DELETE USING (true);


--
-- Name: room_messages Allow public insert access to room_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert access to room_messages" ON public.room_messages FOR INSERT WITH CHECK (true);


--
-- Name: room_players Allow public insert access to room_players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert access to room_players" ON public.room_players FOR INSERT WITH CHECK (true);


--
-- Name: rooms Allow public insert access to rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert access to rooms" ON public.rooms FOR INSERT WITH CHECK (true);


--
-- Name: room_messages Allow public read access to room_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to room_messages" ON public.room_messages FOR SELECT USING (true);


--
-- Name: room_players Allow public read access to room_players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to room_players" ON public.room_players FOR SELECT USING (true);


--
-- Name: rooms Allow public read access to rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to rooms" ON public.rooms FOR SELECT USING (true);


--
-- Name: room_players Allow public update access to room_players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update access to room_players" ON public.room_players FOR UPDATE USING (true);


--
-- Name: rooms Allow public update access to rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update access to rooms" ON public.rooms FOR UPDATE USING (true);


--
-- Name: room_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: room_players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;

--
-- Name: rooms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


