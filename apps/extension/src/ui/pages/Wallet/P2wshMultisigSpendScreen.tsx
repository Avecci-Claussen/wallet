import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import { Button, Column, Content, Header, Input, Layout, Row, Text } from '@/ui/components';
import { p2wshAmountToSats, type P2wshAmountUnit } from '@unisat/wallet-shared';
import { useTools, useWallet } from '@unisat/wallet-state';

export default function P2wshMultisigSpendScreen() {
  const wallet = useWallet();
  const tools = useTools();
  const [info, setInfo] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<P2wshAmountUnit>('btc');
  const [unsigned, setUnsigned] = useState('');
  const [signed, setSigned] = useState('');
  const [partials, setPartials] = useState('');
  const [hex, setHex] = useState('');
  const [summary, setSummary] = useState('');

  const amountHint = useMemo(() => {
    try {
      const sats = p2wshAmountToSats(amount, unit);
      const btc = (sats / 1e8).toFixed(8);
      return `Will send ${sats} sats (${btc} BTC)`;
    } catch {
      return unit === 'btc' ? 'Enter BTC (not sats)' : 'Enter whole sats (not BTC)';
    }
  }, [amount, unit]);

  useEffect(() => {
    wallet
      .getP2wshMultisigInfo()
      .then((i) => setInfo(`${i.k}-of-${i.n}\n${i.address0}\n${i.receive}`))
      .catch((e) => tools.toastError((e as Error).message));
  }, [wallet, tools]);

  const showSummary = async (psbtBase64: string) => {
    const s = await wallet.summarizeP2wshMultisigPsbt(psbtBase64);
    setSummary(
      [
        `sighash ${s.sighash}`,
        `send ${s.send} sats`,
        `change ${s.change} sats (must be this wallet’s change descriptor)`,
        `fee ${s.fee} sats`,
        ...s.outputs.map((o) => `${o.isChange ? 'change' : 'pay'} ${o.value} → ${o.address}`)
      ].join('\n')
    );
  };

  const onBuild = async () => {
    try {
      const sats = p2wshAmountToSats(amount, unit);
      const built = await wallet.buildP2wshMultisigPsbt({ to: to.trim(), amount: sats });
      setUnsigned(built.psbtBase64);
      await navigator.clipboard.writeText(built.psbtBase64);
      await showSummary(built.psbtBase64);
      tools.toastSuccess('Unsigned PSBT copied — other signers paste it and sign');
    } catch (e) {
      tools.toastError((e as Error).message);
    }
  };

  const onSign = async () => {
    try {
      await showSummary(unsigned.trim());
      const out = await wallet.signP2wshMultisigPsbt(unsigned.trim());
      setSigned(out.psbtBase64);
      await navigator.clipboard.writeText(out.psbtBase64);
      tools.toastSuccess('Partial PSBT signed and copied');
    } catch (e) {
      tools.toastError((e as Error).message);
    }
  };

  const onCombine = async () => {
    try {
      const blobs = [signed, ...partials.split(/\n---+\n|\n\n+/)]
        .map((s) => s.trim())
        .filter(Boolean);
      const out = await wallet.combineP2wshMultisigPsbts(blobs);
      setHex(out.hex);
      await navigator.clipboard.writeText(out.hex);
      tools.toastSuccess(`Combined tx ${out.txid}`);
    } catch (e) {
      tools.toastError((e as Error).message);
    }
  };

  const onBroadcast = async () => {
    try {
      const txid = await wallet.broadcastP2wshMultisigTx(hex.trim());
      tools.toastSuccess(typeof txid === 'string' ? txid : 'Broadcast');
    } catch (e) {
      tools.toastError((e as Error).message);
    }
  };

  return (
    <Layout>
      <Header
        onBack={() => {
          window.history.go(-1);
        }}
        title="P2WSH multisig spend"
      />
      <Content>
        <Column gap="lg">
          <Text
            size="sm"
            color="textDim"
            wrap
            text="Each signer opens Send in their own UniSat. k partial PSBTs → combine → broadcast. Not a dApp. Change stays on this wallet’s wsh(sortedmulti) change chain."
          />
          {info ? <Text size="xs" wrap text={info} /> : null}

          <Text text="1. Build unsigned PSBT (any one signer)" preset="regular-bold" />
          <Input placeholder="destination address" onChange={(e) => setTo(e.target.value)} />
          <Row>
            <Button
              text="BTC"
              preset={unit === 'btc' ? 'primary' : 'default'}
              onClick={() => setUnit('btc')}
            />
            <Button
              text="sats"
              preset={unit === 'sats' ? 'primary' : 'default'}
              onClick={() => setUnit('sats')}
            />
          </Row>
          <Input
            placeholder={unit === 'btc' ? 'amount in BTC (e.g. 0.0001)' : 'amount in sats (e.g. 10000)'}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Text size="xs" color="textDim" wrap text={amountHint} />
          <Button text="Build + copy unsigned PSBT" onClick={onBuild} />

          <Text text="2. Sign locally (this seed)" preset="regular-bold" />
          <textarea
            value={unsigned}
            onChange={(e) => setUnsigned(e.target.value)}
            placeholder="paste unsigned PSBT (base64)"
            style={areaStyle}
          />
          <Button text="Sign + copy partial" onClick={onSign} />
          {signed ? <Text size="xs" wrap text="Partial ready — send to the combiner" /> : null}

          <Text text="3. Combine k partials" preset="regular-bold" />
          <textarea
            value={partials}
            onChange={(e) => setPartials(e.target.value)}
            placeholder="paste other signed PSBTs, separated by ---"
            style={areaStyle}
          />
          <Button text="Combine + finalize" onClick={onCombine} />

          <Text text="4. Broadcast" preset="regular-bold" />
          <textarea value={hex} onChange={(e) => setHex(e.target.value)} placeholder="tx hex" style={areaStyle} />
          <Button text="Broadcast" preset="primary" onClick={onBroadcast} />

          {summary ? <Text size="xs" wrap text={summary} /> : null}
        </Column>
      </Content>
    </Layout>
  );
}

const areaStyle: CSSProperties = {
  width: '100%',
  minHeight: 72,
  boxSizing: 'border-box',
  padding: 10,
  borderRadius: 8,
  border: '1px solid #333',
  background: '#111',
  color: '#eee',
  fontFamily: 'ui-monospace, monospace',
  fontSize: 11
};
