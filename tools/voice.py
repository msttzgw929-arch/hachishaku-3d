# VOICEVOX core (九州そら) emotional line generation
import glob, json, subprocess, os, sys
from voicevox_core.blocking import Onnxruntime, OpenJtalk, Synthesizer, VoiceModelFile
VV='/workspace/vv/vc'
ort=Onnxruntime.load_once(filename=glob.glob(VV+'/onnxruntime/lib/libvoicevox_onnxruntime.so*')[0])
dic=glob.glob(VV+'/dict/open_jtalk_dic*')[0]
syn=Synthesizer(ort,OpenJtalk(dic))
with VoiceModelFile.open(VV+'/models/vvms/2.vvm') as m: syn.load_voice_model(m)
with VoiceModelFile.open(VV+'/models/vvms/5.vvm') as m: syn.load_voice_model(m)
S={'normal':16,'ama':15,'tsun':18,'sexy':17,'whisper':19}
# key: (text, style, speed, pitch, intonation, volume, pitch_tail)
L={
 'start1':("ぽぽぽ……ねぇ、ボク？お姉さんと、あそびましょ？",'sexy',0.92,0.0,1.5,1.0,0),
 'tease1':("ぽぽぽ……ねぇ、まってぇ〜？",'ama',0.88,0.02,1.7,1.0,0.06),
 'tease2':("うふふっ、どこへ行くのかしら？",'sexy',0.95,0.0,1.6,1.0,0.05),
 'tease3':("逃げても無駄よぉ。お姉さん、足は長いんだから。",'sexy',0.95,0.0,1.5,1.0,0),
 'tease4':("ぽぽぽぽ……みぃつけた。",'whisper',0.85,0.0,1.4,1.6,0),
 'tease5':("うふふ、鬼ごっこ、楽しいわねぇ？",'ama',0.95,0.0,1.6,1.0,0.05),
 'near1':("ほぉら、もうすぐそこよ？",'sexy',0.9,0.0,1.7,1.0,0.05),
 'near2':("ぽぽぽぽぽっ！",'tsun',1.15,0.03,1.6,1.1,0),
 'irr1':("もう！どうして逃げるのよ！",'tsun',1.08,0.03,1.8,1.15,0),
 'irr2':("ちょこまかしないでっ！",'tsun',1.12,0.04,1.8,1.15,0),
 'irr3':("いい加減にしなさいっ！",'tsun',1.05,0.02,1.9,1.2,0),
 'irr4':("待ちなさいってば！もうっ！",'tsun',1.1,0.03,1.8,1.15,0),
 'grow1':("お腹が、また大きくなっちゃう……あなたのせいよ！",'tsun',1.0,0.02,1.8,1.15,0),
 'grow2':("ああもうっ！イライラして、お腹がふくらんじゃう！",'tsun',1.05,0.04,1.9,1.2,0),
 'grow3':("見なさい、このお腹！ぜんぶ、あなたのせいなんだから！",'tsun',1.02,0.03,1.8,1.2,0),
 'grow4':("まだまだ大きくなるわよぉ……覚悟しなさいっ！",'sexy',0.97,0.0,1.7,1.15,0),
 'grab1':("つかまえたぁ。",'ama',0.85,0.03,1.9,1.1,0.08),
 'grab2':("うふふ……もう、離さないわよ？",'sexy',0.9,0.0,1.6,1.05,0.05),
 'grab3':("はぁい、つかまえた。いい子ねぇ。",'ama',0.9,0.02,1.7,1.05,0.04),
 'slap1':("ひゃんっ！",'normal',1.1,0.08,1.6,1.2,0),
 'slap2':("いたぁいっ！",'tsun',1.05,0.07,1.8,1.2,0),
 'slap3':("やんっ、叩かないでぇ！",'ama',1.1,0.06,1.8,1.15,0),
 'slap4':("ちょっと、お腹はだめぇっ！",'ama',1.1,0.05,1.8,1.15,0),
 'slap5':("きゃっ！",'normal',1.1,0.09,1.5,1.2,0),
 'slap6':("ひぅっ！",'ama',1.1,0.08,1.6,1.2,0),
 'esc1':("あぁん、逃げられちゃった……",'ama',0.92,0.02,1.7,1.05,0),
 'esc2':("もうっ！ひどいじゃないっ！",'tsun',1.08,0.04,1.8,1.15,0),
 'crash1':("あら、ごめんなさいね？お腹がぶつかっちゃった。",'sexy',0.97,0.0,1.6,1.05,0.04),
 'crash2':("邪魔よっ！",'tsun',1.05,0.02,1.9,1.2,0),
 'crash3':("おほほほっ！建物なんて関係ないわ！",'ama',1.0,0.03,1.8,1.15,0),
 'over1':("うふふ……これで、ずぅっとお姉さんと一緒ね。",'whisper',0.85,0.0,1.4,1.7,0),
}
out='/workspace/hachishaku-3d/tools/voice_vv'; os.makedirs(out,exist_ok=True)
only=sys.argv[1:]
for k,(t,st,sp,pi,it,vo,tail) in L.items():
    if only and k not in only: continue
    q=syn.create_audio_query(t,S[st])
    q.speed_scale=sp; q.pitch_scale=pi; q.intonation_scale=it; q.volume_scale=vo
    q.pre_phoneme_length=0.05; q.post_phoneme_length=0.15
    # emotional rise at phrase ends (questions / teasing tails)
    if tail:
        for ap in q.accent_phrases:
            ms=[m for m in ap.moras if m.pitch>0]
            for i,m in enumerate(ms[-2:]): m.pitch+=tail*(i+1)*2
    w=syn.synthesis(q,S[st])
    open('/tmp/v.wav','wb').write(w)
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i','/tmp/v.wav','-af',
      'highpass=f=70,aecho=0.8:0.5:45|90:0.18|0.10,loudnorm=I=-16:TP=-1.5:LRA=11','-ac','1','-ar','44100','-b:a','80k',f'{out}/{k}.mp3'],check=True)
    print(k, t)
json.dump({k:v[0] for k,v in L.items()},open(out+'/lines.json','w'),ensure_ascii=False,indent=0)
