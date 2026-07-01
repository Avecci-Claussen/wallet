import { BRC20BalanceCardProps, useBRC20BalanceCardLogic } from '@unisat/wallet-state';

import { BRC20Ticker } from '../BRC20Ticker';
import { Card } from '../Card';
import { Column } from '../Column';
import { Row } from '../Row';
import Tag from '../Tag';
import { Text } from '../Text';
import { getTokenBalanceCardStyle, TokenBalanceCardLayout } from '../TokenBalanceCardLayout';
import { TokenBalanceIcon } from '../TokenBalanceIcon';

export default function BRC20BalanceCard(props: BRC20BalanceCardProps) {
  const {
    showPrice,
    price,
    ticker,
    iconInfo,
    displayName,
    tag,
    onClick,
    totalBalance,
    selfMint,
    onProgBalance,
    hasOutWalletBalance,
    inWalletBalance,
    onSwapBalance,
    t
  } = useBRC20BalanceCardLogic(props);

  const adaptiveHeight = Boolean(hasOutWalletBalance);

  return (
    <Card
      fullX
      onClick={() => {
        onClick && onClick();
      }}
      style={getTokenBalanceCardStyle(adaptiveHeight)}>
      <TokenBalanceCardLayout
        icon={<TokenBalanceIcon iconInfo={iconInfo} />}
        onIconClick={onClick}
        title={<BRC20Ticker tick={ticker} displayName={displayName} truncate />}
        titleExtra={
          tag || selfMint ? (
            <Row gap="sm" itemsCenter>
              {tag && <Tag type={tag} />}
              {selfMint && <Tag type="self-issuance" small />}
            </Row>
          ) : null
        }
        quantity={<Text text={totalBalance} size="xs" digital />}
        showPrice={showPrice}
        price={price}
        balance={totalBalance}
      />

      {hasOutWalletBalance ? (
        <Column fullX gap="zero">
          <Row style={{ borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} mb="sm" />
          <Row fullY justifyBetween justifyCenter>
            <Column fullY justifyCenter>
              <Text text={t('brc20_in_wallet')} color="textDim" size="xs" />
            </Column>

            <Row itemsCenter fullY gap="zero">
              <Text text={inWalletBalance} size="xs" digital />
            </Row>
          </Row>

          {onSwapBalance && onSwapBalance !== '0' ? (
            <Row fullY justifyBetween justifyCenter>
              <Column fullY justifyCenter>
                <Text text={t('brc20_on_swap')} color="textDim" size="xs" />
              </Column>

              <Row itemsCenter fullY gap="zero">
                <Text text={onSwapBalance} size="xs" digital />
              </Row>
            </Row>
          ) : null}

          {onProgBalance && onProgBalance !== '0' ? (
            <Row fullY justifyBetween justifyCenter>
              <Column fullY justifyCenter>
                <Text text={t('brc20_on_prog')} color="textDim" size="xs" />
              </Column>

              <Row itemsCenter fullY gap="zero">
                <Text text={onProgBalance} size="xs" digital />
              </Row>
            </Row>
          ) : null}
        </Column>
      ) : null}
    </Card>
  );
}
